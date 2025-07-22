import type { NextApiRequest, NextApiResponse } from 'next';
import { executePipeline, Graph } from '@/services/executePipeline';
import { verifyIdToken } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
// Import the correct OpenAI client for Azure
import { OpenAI } from 'openai';
import { getFirestore } from '@/lib/firebase-admin';
import { modelMapping } from '@/lib/azureOpenAI';

interface RequestBody {
  graph?: Graph;
  prompt: string;
  userId?: string; // For chat-centric interface
  chatMode?: boolean; // Flag to indicate chat-centric mode
}

// Define response data type
type ResponseData = {
  result: string | null;
  error?: string;
  response?: string;
  usageReport?: {
    tokens: number;
    model: string;
    timestamp: string;
  }
  retrieved?: string[];
};

/**
 * API route handler for running a pipeline
 * 
 * @param req Next.js API request
 * @param res Next.js API response
 */
// Helper function to generate real responses using Azure OpenAI
async function generateOpenAIResponse(prompt: string, userId: string): Promise<string> {
  // Azure OpenAI configuration
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const turboDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo';
  
  if (!azureApiKey || !azureEndpoint) {
    throw new Error('Azure OpenAI API key or endpoint not configured');
  }

  // Initialize OpenAI client with Azure configuration
  const openai = new OpenAI({
    apiKey: azureApiKey,
    baseURL: `${azureEndpoint}/openai/deployments/${turboDeployment}`,
    defaultQuery: { 'api-version': '2023-05-15' },
    defaultHeaders: { 'api-key': azureApiKey }
  });
  
  // Record the usage to Firestore for monitoring and billing
  const adminDb = await getFirestore();
  await adminDb.collection('usage').add({
    userId,
    timestamp: new Date(),
    service: 'azure-openai',
    model: turboDeployment,
    tokens: prompt.length / 4, // Rough estimate for tracking
    operation: 'pipeline-chat'
  });
  
  // Generate a response with OpenAI
  const response = await openai.chat.completions.create({
    model: turboDeployment, // This is ignored when using Azure OpenAI
    messages: [
      { role: "system", content: "You are an AI assistant helping with RAG pipeline configuration for the Contexto platform. Provide helpful, technical, and accurate information about data processing, embeddings, vector stores, and retrieval configuration." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  });
  
  return response.choices[0]?.message?.content || 
    "I'm sorry, I couldn't generate a response. Please try again.";

}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ result: null, error: 'Method not allowed' });
  }

  try {
    // Authentication is required for production usage
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        result: null, 
        error: 'Authentication required. Please provide a valid Firebase ID token.' 
      });
    }
    
    // Verify the token and extract user ID
    let userId: string;
    try {
      const token = authHeader.substring(7);
      const decodedToken = await verifyIdToken(token);
      userId = decodedToken.uid;
      
      if (!userId) {
        throw new Error('User ID not found in token');
      }
    } catch (authError) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ 
        result: null, 
        error: 'Invalid authentication token. Please sign in again.' 
      });
    }

    // Extract request parameters
    const { graph, prompt, pipelineId, chatMode, userId: bodyUserId } = req.body as RequestBody & { pipelineId?: string };
    
    // For chat-centric mode, we don't require a graph as we'll use a default one
    if (!prompt) {
      return res.status(400).json({ 
        result: null, 
        error: 'Missing required parameter: prompt is required' 
      });
    }
    
    // If in chat mode and no graph is provided, log the query for analytics
    if (chatMode) {
      try {
        await addDoc(collection(db, 'chatQueries'), {
          userId,
          prompt,
          timestamp: serverTimestamp(),
        });
      } catch (logError) {
        console.error('Error logging chat query:', logError);
        // Continue execution even if logging fails
      }
    } else if (!graph) {
      // In standard mode, graph is required
      return res.status(400).json({ 
        result: null, 
        error: 'Missing required parameter: graph is required for non-chat mode' 
      });
    }
    
    // If pipelineId is provided, verify ownership
    if (pipelineId) {
      try {
        // Check if this pipeline exists and belongs to the user
        const pipelineRef = doc(db, 'pipelines', pipelineId);
        const pipelineDoc = await getDoc(pipelineRef);
        
        if (!pipelineDoc.exists()) {
          return res.status(404).json({
            result: null,
            error: 'Pipeline not found'
          });
        }
        
        // Verify pipeline ownership for multi-tenant security
        const pipelineData = pipelineDoc.data();
        if (pipelineData.userId !== userId) {
          return res.status(403).json({
            result: null,
            error: 'You do not have permission to execute this pipeline'
          });
        }
      } catch (dbError) {
        console.error('Database error when verifying pipeline ownership:', dbError);
        return res.status(500).json({
          result: null,
          error: 'Failed to verify pipeline ownership'
        });
      }
    }

    // Execute the pipeline
    try {
      console.log(`Executing pipeline for user ${userId}`);
      
      // For chat mode with no graph, generate a response using Azure OpenAI
      if (chatMode && !graph) {
        const response = await generateOpenAIResponse(prompt, userId);
        
        return res.status(200).json({
          result: response,
          response: response, // For chat interface compatibility
          usageReport: {
            model: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-35-turbo',
            tokens: Math.floor(prompt.length / 4),
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Standard pipeline execution
      // Extract the file ID from the graph's data source node
      const dataSourceNode = graph?.nodes.find(node => node.type === 'dataSource');
      const fileId = dataSourceNode?.data?.settings?.fileId || 'default-file-id';
      
      // Execute the pipeline with the extracted file ID
      const pipelineResult = await executePipeline(fileId, prompt, userId);

      // Return the results
      return res.status(200).json({
        result: pipelineResult.answer,
        response: pipelineResult.answer, // For chat interface compatibility
        retrieved: pipelineResult.retrieved,
        usageReport: {
          tokens: prompt.length / 4, // Rough estimate
          model: 'pipeline-execution',
          timestamp: new Date().toISOString()
        }
      });
    } catch (executionError) {
      console.error('Pipeline execution error:', executionError);
      
      // Provide specific error messages based on error types
      if (executionError instanceof Error) {
        const errorMessage = executionError.message;
        
        if (errorMessage.includes('Azure OpenAI client not available')) {
          return res.status(503).json({
            result: null,
            error: 'AI service unavailable. Please try again later.'
          });
        } else if (errorMessage.includes('Invalid pipeline graph')) {
          return res.status(400).json({
            result: null,
            error: 'Invalid pipeline configuration. Please check your pipeline setup.'
          });
        } else {
          return res.status(500).json({
            result: null,
            error: `Pipeline execution failed: ${errorMessage}`
          });
        }
      }
      
      return res.status(500).json({
        result: null,
        error: 'Unknown error during pipeline execution'
      });
    }
  } catch (error) {
    console.error('Unhandled error in runPipeline API:', error);
    return res.status(500).json({
      result: null,
      error: 'An unexpected error occurred'
    });
  }
}
