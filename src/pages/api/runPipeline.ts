import type { NextApiRequest, NextApiResponse } from 'next';
import { executePipeline, Graph } from '@/services/executePipeline';
import { verifyIdToken } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface RequestBody {
  graph?: Graph;
  prompt: string;
  userId?: string; // For chat-centric interface
  chatMode?: boolean; // Flag to indicate chat-centric mode
}

interface ResponseData {
  result: any;
  response?: any; // Added for chat interface compatibility
  usageReport?: Record<string, any>;
  error?: string;
}

/**
 * API route handler for running a pipeline
 * 
 * @param req Next.js API request
 * @param res Next.js API response
 */
// Helper function to generate mock responses based on the prompt
async function generateMockResponse(prompt: string): Promise<string> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const lowercasePrompt = prompt.toLowerCase();
  
  // Return contextual responses based on prompt content
  if (lowercasePrompt.includes('import') || lowercasePrompt.includes('data')) {
    return "Your data has been successfully imported and indexed. You can now ask questions about the content. The pipeline processed your files and created embeddings for efficient retrieval. For best results, try asking specific questions about the content of your documents.";
  }
  
  if (lowercasePrompt.includes('export') || lowercasePrompt.includes('pipeline')) {
    return "You can export your pipeline configuration by clicking the 'Export MCP Pipeline' button below. This will download a JSON file with your pipeline configuration that can be used with the MCP standard. The exported pipeline includes all nodes, edges, and parameters you've configured.";
  }
  
  if (lowercasePrompt.includes('advanced') || lowercasePrompt.includes('view') || lowercasePrompt.includes('toggle')) {
    return "You can switch to the advanced view by clicking the 'Advanced' toggle in the top-right corner. This will show you the full pipeline editor with the canvas, node palette, and configuration options. The advanced view gives you complete control over the RAG pipeline structure and parameters.";
  }
  
  if (lowercasePrompt.includes('how') && lowercasePrompt.includes('work')) {
    return "Contexto works by creating a pipeline that processes your data through several steps: importing and chunking your documents, creating vector embeddings for semantic search, and then using a retrieval-augmented generation (RAG) approach to provide context-aware responses using your own data. The chat interface simplifies this process while the advanced view gives you full control over the pipeline.";
  }
  
  if (lowercasePrompt.includes('firebase') || lowercasePrompt.includes('authentication') || lowercasePrompt.includes('login')) {
    return "Contexto uses Firebase for authentication, data storage, and analytics. Your pipelines and usage metrics are securely stored in Firestore, and you can sign in with Google or email/password authentication. All data processing happens in your browser for maximum privacy.";
  }
  
  if (lowercasePrompt.includes('customize') || lowercasePrompt.includes('settings') || lowercasePrompt.includes('configure')) {
    return "You can customize your Contexto experience in several ways: 1) Use the chat interface for simple interactions, 2) Switch to the advanced view for complete pipeline control, 3) Adjust embedding and LLM parameters in the advanced view, or 4) Export your pipeline configuration to share or reuse later.";
  }
  
  // Default response with more context
  return "I've analyzed your request using the Contexto pipeline. The system has processed your query through the embedding model and retrieved relevant context from your imported data. The RAG pipeline used includes document chunking, vector embedding generation, similarity search, and context-enhanced response generation. To customize how this works, you can use the Advanced view to modify the pipeline structure and parameters.";

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
      
      // For chat mode with no graph, generate a mock response
      if (chatMode && !graph) {
        const response = await generateMockResponse(prompt);
        
        return res.status(200).json({
          result: response,
          response: response, // For chat interface compatibility
          usageReport: {
            tokens: prompt.length / 4, // Rough estimate
            model: 'chat-mock-model',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Standard pipeline execution
      // Use non-null assertion since we've already checked graph is defined for non-chat mode
      const { result, usageReport } = await executePipeline(graph!, prompt, userId);

      // Return the results
      return res.status(200).json({
        result,
        response: result, // For chat interface compatibility
        usageReport
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
