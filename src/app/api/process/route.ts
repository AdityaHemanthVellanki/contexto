import { NextResponse } from 'next/server';
import { getAuth, getFirestore } from '@/lib/firebase-admin';
import { executePipeline } from '@/services/executePipeline';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Process route - Handles file processing requests via the MCP pipeline
 * POST /api/process
 * 
 * Expected body: { fileId: string, question: string }
 * Required headers: Authorization: Bearer <Firebase ID Token>
 */
export async function POST(request: Request) {
  try {
    const { fileId, question } = await request.json();
    
    // Validate input parameters
    if (!fileId || !question) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId and question are required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No valid token provided' },
        { status: 401 }
      );
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Verify the Firebase ID token
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const userId = decodedToken.uid;
      
      console.log(`Processing request for user ${userId}, file ${fileId}`);
      
      // Store the query in Firestore for history tracking
      const db = getFirestore();
      const queryRef = db.collection(`users/${userId}/queries`).doc();
      await queryRef.set({
        fileId,
        question,
        timestamp: FieldValue.serverTimestamp(),
        status: 'processing'
      });

      // Execute the MCP pipeline with specific error handling for PDF extraction and embeddings
      console.time('mcp-pipeline');
      try {
        const result = await executePipeline(fileId, question, idToken);
        console.timeEnd('mcp-pipeline');
        
        // Update the query with the results
        await queryRef.update({
          status: 'completed',
          answer: result.answer,
          retrievedCount: result.retrieved.length,
          completedAt: FieldValue.serverTimestamp()
        });

        // Return the result
        return NextResponse.json({
          answer: result.answer,
          fileId,
          retrieved: result.retrieved,
        });
      } catch (pipelineError) {
        console.error('Pipeline execution error:', pipelineError);
        console.timeEnd('mcp-pipeline');
        
        // Update the query with error status
        await queryRef.update({
          status: 'failed',
          error: pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error',
          completedAt: FieldValue.serverTimestamp()
        });
        
        // Categorize errors based on message content for better client handling
        const errorMessage = pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error';
        
        // Handle PDF extraction errors
        if (errorMessage.includes('PDF extraction failed')) {
          return NextResponse.json(
            { error: 'PDF extraction failed - The file may be corrupted or password-protected' },
            { status: 422 } // Unprocessable Entity
          );
        }
        
        // Handle embedding/Azure OpenAI errors
        if (errorMessage.includes('Azure OpenAI') || errorMessage.includes('Embedder failed')) {
          return NextResponse.json(
            { error: 'Embedding generation failed - Please check your Azure OpenAI configuration' },
            { status: 500 }
          );
        }
        
        // Generic pipeline error
        return NextResponse.json(
          { error: `Pipeline execution error: ${errorMessage}` },
          { status: 500 }
        );
      }
    } catch (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error processing MCP pipeline:', error);
    
    // Return user-friendly error message
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
