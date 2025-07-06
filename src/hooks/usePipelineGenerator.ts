import { useState } from 'react';
import { client, modelMapping } from '@/lib/azureOpenAI';
import { Node, Edge } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';

interface PipelineGeneratorResult {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export function usePipelineGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  /**
   * Generates a pipeline configuration based on a natural language description
   * Uses Azure OpenAI to generate the node structure and connections
   * 
   * @param description Natural language description of the desired pipeline
   * @returns Generated nodes and edges
   */
  const generatePipeline = async (description: string): Promise<PipelineGeneratorResult> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Call Azure OpenAI to generate pipeline configuration
      const response = await client.chat.completions.create({
        model: modelMapping.refine as string,
        messages: [
          {
            role: 'system',
            content: `You are a pipeline generator assistant. Generate a valid RAG pipeline configuration based on the user's description.
              The pipeline should have nodes of these types: dataSource, chunker, embedder, indexer, retriever, output.
              Format the response as JSON with 'nodes' and 'edges' arrays following React Flow's format.
              For nodes: { id: string, type: string, position: {x, y}, data: { type: string, label: string, settings: {} } }
              For edges: { id: string, source: string, target: string, type: 'smoothstep' }
              Position nodes in a logical left-to-right flow with appropriate spacing.`
          },
          {
            role: 'user',
            content: description
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      // Extract the JSON response
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content returned from pipeline generator');
      }
      
      // Parse the JSON response
      const pipelineConfig = JSON.parse(content);
      
      // Validate the response structure
      if (!pipelineConfig.nodes || !Array.isArray(pipelineConfig.nodes) || !pipelineConfig.edges || !Array.isArray(pipelineConfig.edges)) {
        throw new Error('Invalid pipeline configuration format');
      }
      
      // Process the nodes to ensure they have all required properties
      const processedNodes = pipelineConfig.nodes.map((node: any) => ({
        ...node,
        // Ensure node has all required properties
        id: node.id || `node-${Math.random().toString(36).substring(2, 9)}`,
        type: node.type || 'dataSource',
        position: node.position || { x: 0, y: 0 },
        data: {
          type: node.data?.type || node.type || 'dataSource',
          label: node.data?.label || `New ${node.type || 'Node'}`,
          settings: node.data?.settings || {}
        }
      }));
      
      // Process the edges to ensure they have all required properties
      const processedEdges = pipelineConfig.edges.map((edge: any) => ({
        ...edge,
        // Ensure edge has all required properties
        id: edge.id || `edge-${edge.source}-${edge.target}`,
        type: edge.type || 'smoothstep',
        animated: true,
        style: { stroke: '#2563eb', strokeWidth: 2 }
      }));
      
      return {
        nodes: processedNodes,
        edges: processedEdges
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error in pipeline generation');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    generatePipeline,
    isLoading,
    error
  };
}
