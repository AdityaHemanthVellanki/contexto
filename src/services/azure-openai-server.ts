/**
 * Server-side Azure OpenAI API service
 * Production implementation for Node.js server components
 */

// Import the correct Azure OpenAI API classes
import { OpenAI } from "openai";

// Import Firestore from our shared Firebase Admin initialization module
import { Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';

// Environment variables for Azure OpenAI API
const {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
  AZURE_OPENAI_DEPLOYMENT_TURBO,
  AZURE_OPENAI_DEPLOYMENT_GPT4,
  AZURE_OPENAI_DEPLOYMENT_OMNI
} = process.env;

// Models for our different API endpoints - these should match the actual deployment names
const MODEL_MAPPING = {
  default: AZURE_OPENAI_DEPLOYMENT_GPT4 || AZURE_OPENAI_DEPLOYMENT_TURBO || "gpt-4",
  pipeline: AZURE_OPENAI_DEPLOYMENT_GPT4 || AZURE_OPENAI_DEPLOYMENT_TURBO || "gpt-4"
};

/**
 * Validate Azure OpenAI credentials and throw clear error if missing
 * @param {string} [operation] - Optional operation name for more specific error messages
 */
function validateAzureOpenAICredentials(operation?: string) {
  const context = operation ? ` for ${operation}` : '';
  
  // Check API key
  if (!AZURE_OPENAI_API_KEY) {
    throw new Error(
      `Azure OpenAI API key missing${context}. ` +
      'Please set the AZURE_OPENAI_API_KEY environment variable.'
    );
  }
  
  // Check endpoint
  if (!AZURE_OPENAI_ENDPOINT) {
    throw new Error(
      `Azure OpenAI endpoint missing${context}. ` +
      'Please set the AZURE_OPENAI_ENDPOINT environment variable.'
    );
  }
  
  // Validate endpoint format
  if (!AZURE_OPENAI_ENDPOINT.startsWith('https://')) {
    throw new Error(
      `Invalid Azure OpenAI endpoint format${context}. ` +
      'AZURE_OPENAI_ENDPOINT must start with https://'
    );
  }
  
  if (AZURE_OPENAI_ENDPOINT.endsWith('/')) {
    throw new Error(
      `Invalid Azure OpenAI endpoint format${context}. ` +
      'AZURE_OPENAI_ENDPOINT must not end with a trailing slash'
    );
  }
  
  // Check for at least one deployment
  if (!AZURE_OPENAI_DEPLOYMENT_TURBO && !AZURE_OPENAI_DEPLOYMENT_GPT4) {
    throw new Error(
      `Azure OpenAI deployment configuration missing${context}. ` +
      'Please set at least one of AZURE_OPENAI_DEPLOYMENT_TURBO or AZURE_OPENAI_DEPLOYMENT_GPT4 environment variables.'
    );
  }
}

/**
 * Generate a pipeline from a natural language prompt using Azure OpenAI
 * Server-side implementation that calls Azure OpenAI directly
 * 
 * @param prompt The user's natural language description of the pipeline
 * @returns A promise that resolves to a pipeline definition
 */
export async function generatePipelineFromPrompt(prompt: string): Promise<{
  nodes: any[];
  edges: any[];
  explanation: string;
}> {
  // Validate credentials with detailed error messages
  validateAzureOpenAICredentials('pipeline generation');
  
  // Use GPT4 deployment as preferred, fall back to TURBO if not available
  const deploymentName = AZURE_OPENAI_DEPLOYMENT_GPT4 || AZURE_OPENAI_DEPLOYMENT_TURBO;
  if (!deploymentName) {
    throw new Error('No valid Azure OpenAI deployment found for pipeline generation. Please set AZURE_OPENAI_DEPLOYMENT_GPT4 or AZURE_OPENAI_DEPLOYMENT_TURBO environment variables.');
  }

  try {
    // Create Azure-configured OpenAI client
    const client = new OpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${deploymentName}`,
      defaultQuery: { "api-version": "2023-05-15" },
      defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY }
    });

    // Build system message with pipeline creation instructions
    const systemMessage = `You are an AI assistant that creates MCP (Model Context Protocol) pipelines based on user descriptions.
    The pipeline should include appropriate nodes for data processing, embedding, and vector storage.
    Return the response as a JSON object with the following structure:
    {
      "nodes": [
        {
          "id": "unique-id-1",
          "type": "nodeType",
          "data": { "label": "Node Label", "settings": { ...node specific settings } },
          "position": { "x": 0, "y": 0 }
        }
      ],
      "edges": [
        {
          "id": "edge-1",
          "source": "source-node-id",
          "target": "target-node-id"
        }
      ],
      "explanation": "A human-readable explanation of what this pipeline does"
    }`;

    // Create messages array for the API call
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt }
    ];

    // Get completion from OpenAI with Azure configuration
    const response = await client.chat.completions.create({
      model: MODEL_MAPPING.pipeline,
      messages: messages as any, // Type assertion needed due to OpenAI types
      max_tokens: 4000,
      temperature: 0.7
    });

    // Extract and parse the response
    const content = response.choices[0]?.message?.content || '';
    
    // Parse the JSON response safely
    let pipelineData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/);
      const jsonString = jsonMatch ? jsonMatch[0].replace(/```json\n|```/g, '') : content;
      pipelineData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse pipeline JSON:", parseError);
      throw new Error("The AI generated an invalid pipeline format");
    }

    // Log the generated pipeline to Firestore for analytics
    try {
      // Get Firestore instance from our shared Firebase Admin initialization module
      const db = initializeFirebaseAdmin();
      await db.collection('pipeline-generations').add({
        prompt,
        timestamp: Timestamp.now(),
        success: true,
        nodeCount: pipelineData.nodes.length,
        edgeCount: pipelineData.edges.length
      });
    } catch (error) {
      // Non-blocking error - just log it
      console.error('Failed to log pipeline generation:', error instanceof Error ? error.message : String(error));
    }

    return {
      nodes: pipelineData.nodes || [],
      edges: pipelineData.edges || [],
      explanation: pipelineData.explanation || "Pipeline generated successfully."
    };
  } catch (error) {
    console.error("Error generating pipeline:", error);
    
    // Log error to Firestore
    try {
      // Get Firestore instance from our shared Firebase Admin initialization module
      const db = initializeFirebaseAdmin();
      await db.collection('pipeline-errors').add({
        prompt,
        timestamp: Timestamp.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error("Failed to log pipeline generation error:", logError);
    }
    
    throw new Error(`Failed to generate pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a chat response for pipeline information
 * Used for explaining pipeline processing outcomes to users
 * 
 * @param prompt The prompt describing the pipeline outcome
 * @returns A human-friendly explanation
 */
export async function generateChatResponse(prompt: string): Promise<string> {
  // Validate credentials with detailed error messages
  validateAzureOpenAICredentials('chat response generation');
  
  // Use TURBO deployment as preferred for chat responses (more cost-effective)
  const deploymentName = AZURE_OPENAI_DEPLOYMENT_TURBO || AZURE_OPENAI_DEPLOYMENT_GPT4;
  if (!deploymentName) {
    throw new Error('No valid Azure OpenAI deployment found for chat response generation. Please set AZURE_OPENAI_DEPLOYMENT_TURBO or AZURE_OPENAI_DEPLOYMENT_GPT4 environment variables.');
  }

  try {
    // Create Azure-configured OpenAI client
    const client = new OpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${deploymentName}`,
      defaultQuery: { "api-version": "2023-05-15" },
      defaultHeaders: { "api-key": AZURE_OPENAI_API_KEY }
    });
    
    const messages = [
      { role: "system", content: "You are a helpful AI assistant explaining technical processes in clear language." },
      { role: "user", content: prompt }
    ];

    const response = await client.chat.completions.create({
      model: MODEL_MAPPING.default,
      messages: messages as any, // Type assertion needed due to OpenAI types
      max_tokens: 800,
      temperature: 0.7
    });

    // Return the response text, throw if no content is available
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Azure OpenAI returned empty response content');
    }
    return content;
  } catch (error) {
    console.error("Error generating chat response:", error);
    // Propagate the error instead of returning a fallback
    throw new Error(`Azure OpenAI chat response failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
