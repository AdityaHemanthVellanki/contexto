import type { NextApiRequest, NextApiResponse } from 'next';
import { executePipeline, Graph } from '@/services/executePipeline';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface RequestBody {
  graph: Graph;
  prompt: string;
}

interface ResponseData {
  result: any;
  usageReport?: Record<string, any>;
  error?: string;
}

/**
 * API route handler for running a pipeline
 * 
 * @param req Next.js API request
 * @param res Next.js API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ result: null, error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin if not already initialized
    getFirebaseAdmin();

    // Verify authentication if Authorization header is present
    const authHeader = req.headers.authorization;
    let userId = 'anonymous';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (authError) {
        console.error('Authentication error:', authError);
        return res.status(401).json({ result: null, error: 'Unauthorized' });
      }
    }

    // Extract the graph and prompt from request body
    const { graph, prompt } = req.body as RequestBody;

    if (!graph || !prompt) {
      return res.status(400).json({ result: null, error: 'Missing required parameters' });
    }

    // Execute the pipeline
    console.log(`Executing pipeline for user ${userId}`);
    const { result, usageReport } = await executePipeline(graph, prompt);

    // Return the results
    return res.status(200).json({
      result,
      usageReport
    });
  } catch (error) {
    console.error('Pipeline execution error:', error);
    return res.status(500).json({
      result: null,
      error: `Error executing pipeline: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}
