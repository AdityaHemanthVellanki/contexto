import type { NextApiRequest, NextApiResponse } from 'next';
import { runRefineAnswer } from '@/services/refineAnswer';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface RequestBody {
  text: string;
  instructions?: string;
}

interface ResponseData {
  result: string | null;
  error?: string;
}

/**
 * API route handler for refining answers using Azure OpenAI
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

    // Extract the text and instructions from request body
    const { text, instructions } = req.body as RequestBody;

    if (!text) {
      return res.status(400).json({ result: null, error: 'Missing required text parameter' });
    }

    // Execute the refinement
    console.log(`Refining answer for user ${userId}`);
    const result = await runRefineAnswer(text, instructions);

    // Return the results
    return res.status(200).json({
      result
    });
  } catch (error) {
    console.error('Answer refinement error:', error);
    return res.status(500).json({
      result: null,
      error: `Error refining answer: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}
