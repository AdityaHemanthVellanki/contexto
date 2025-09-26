import { NextRequest, NextResponse } from 'next/server';
import client, { modelMapping } from '@/lib/azureOpenAI.server';
import { 
  PipelineGenerationRequestSchema, 
  PipelineGenerationResponseSchema,
  PipelineNodeSchema,
  PipelineEdgeSchema,
  NodeType,
  DEFAULT_NODE_CONFIGS,
  NODE_DESCRIPTIONS
} from '@/types/pipeline';
import { logUsage } from '@/services/usage';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const { prompt } = PipelineGenerationRequestSchema.parse(body);

    // System prompt for pipeline generation
    const systemPrompt = `You are an expert MCP (Model Context Protocol) pipeline architect. Generate a complete pipeline configuration based on the user's natural language description.

AVAILABLE NODE TYPES:
- DataSource: ${NODE_DESCRIPTIONS.DataSource}
- Chunker: ${NODE_DESCRIPTIONS.Chunker}
- Embedder: ${NODE_DESCRIPTIONS.Embedder}
- Indexer: ${NODE_DESCRIPTIONS.Indexer}
- Retriever: ${NODE_DESCRIPTIONS.Retriever}
- RAG: ${NODE_DESCRIPTIONS.RAG}

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "nodes": [
    {
      "id": "unique-node-id",
      "type": "NodeType",
      "position": { "x": number, "y": number },
      "data": {
        "label": "Human readable label",
        "description": "Optional description",
        "config": {
          // Node-specific configuration based on type
        }
      }
    }
  ],
  "edges": [
    {
      "id": "unique-edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "type": "smoothstep",
      "animated": true
    }
  ],
  "metadata": {
    "name": "Pipeline Name",
    "description": "Pipeline description",
    "estimatedComplexity": "low|medium|high",
    "suggestedResources": ["resource1", "resource2"]
  }
}

POSITIONING RULES:
- Position nodes left-to-right in logical flow order
- Use 300px horizontal spacing between nodes
- Use 150px vertical spacing for parallel branches
- Start first node at x: 100, y: 100

CONFIGURATION RULES:
- Use appropriate default configurations for each node type
- Customize based on user requirements
- Ensure all required fields are present

PIPELINE FLOW RULES:
- Always start with DataSource
- Follow logical data flow: DataSource → Chunker → Embedder → Indexer → Retriever → RAG
- Create branches only when explicitly requested
- Ensure all nodes are connected in a valid flow

Generate a production-ready pipeline that matches the user's requirements exactly.`;

    // Call Azure OpenAI to generate pipeline
    const response = await client.chat.completions.create({
      model: modelMapping.turbo as string,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    }, {
      path: `/openai/deployments/${modelMapping.turbo}/chat/completions`
    });

    const content = response.choices[0]?.message?.content;
  
    if (!content) {
      return NextResponse.json(
        { error: 'No content returned from Azure OpenAI' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let pipelineConfig;
    try {
      pipelineConfig = JSON.parse(content);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON response from AI model' },
        { status: 500 }
      );
    }

    // Validate and process the pipeline configuration
    try {
      // Validate nodes
      const validatedNodes = pipelineConfig.nodes?.map((node: any) => {
        const validatedNode = PipelineNodeSchema.parse({
          id: node.id || `node-${Math.random().toString(36).substring(2, 9)}`,
          type: node.type,
          position: node.position || { x: 100, y: 100 },
          data: {
            label: node.data?.label || `${node.type} Node`,
            description: node.data?.description || NODE_DESCRIPTIONS[node.type as NodeType],
            config: {
              ...DEFAULT_NODE_CONFIGS[node.type as NodeType],
              ...node.data?.config
            }
          }
        });
        return validatedNode;
      }) || [];

      // Validate edges
      const validatedEdges = pipelineConfig.edges?.map((edge: any) => {
        return PipelineEdgeSchema.parse({
          id: edge.id || `edge-${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'smoothstep',
          animated: edge.animated !== false
        });
      }) || [];

      // Validate metadata
      const metadata = {
        name: pipelineConfig.metadata?.name || 'Generated Pipeline',
        description: pipelineConfig.metadata?.description || 'AI-generated MCP pipeline',
        estimatedComplexity: pipelineConfig.metadata?.estimatedComplexity || 'medium',
        suggestedResources: pipelineConfig.metadata?.suggestedResources || []
      };

      // Check the next response and make sure that the pipeline configs are always set to full

      // Create the final response
      const pipelineResponse = {
        pipelineJson: {
          nodes: validatedNodes,
          edges: validatedEdges,
          metadata
        },
        reasoning: `Generated a ${metadata.estimatedComplexity} complexity pipeline with ${validatedNodes.length} nodes and ${validatedEdges.length} connections based on your requirements.`
      };

      // Validate the complete response
      const validatedResponse = PipelineGenerationResponseSchema.parse(pipelineResponse);

      // Log usage metrics
      try {
        await logUsage('pipeline_generation', {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        }, 'system');
      } catch (logError) {
        console.warn('Failed to log pipeline generation usage:', logError);
      }

      return NextResponse.json(validatedResponse);

    } catch (validationError) {
      console.error('Pipeline validation error:', validationError);
      return NextResponse.json(
        { error: 'Generated pipeline failed validation. Please try again with a more specific description.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Pipeline generation error:', error);
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('401') || error.message.includes('403')) {
        return NextResponse.json(
          { error: 'Azure OpenAI authentication failed. Please check your API configuration.' },
          { status: 401 }
        );
      }
      
      if (error.message.includes('404')) {
        return NextResponse.json(
          { error: 'Azure OpenAI deployment not found. Please check your deployment configuration.' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Pipeline generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
