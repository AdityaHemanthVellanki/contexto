import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { db } from '@/utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { executePipeline } from '@/services/executePipeline';

// Helper function to authenticate requests
async function authenticateRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Unauthorized: No token provided', userId: null };
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    
    return { authenticated: true, error: null, userId: decodedToken.uid };
  } catch (error) {
    console.error('Authentication error:', error);
    return { authenticated: false, error: 'Unauthorized: Invalid token', userId: null };
  }
}

// POST handler for running a pipeline
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const pipelineId = params.id;
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required to run the pipeline' }, { status: 400 });
    }
    
    // Get the pipeline
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    const pipelineDoc = await getDoc(pipelineRef);
    
    if (!pipelineDoc.exists()) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    
    const pipelineData = pipelineDoc.data();
    
    // Check if the user owns this pipeline
    if (pipelineData.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Execute the pipeline with the real implementation
    const pipelineResult = await executePipeline(
      pipelineData.graph,
      prompt,
      userId
    );
    
    // Return the execution result
    return NextResponse.json({
      success: true,
      result: pipelineResult.result,
      usage: pipelineResult.usageReport.total
    });
  } catch (error: any) {
    console.error('Error running pipeline:', error);
    
    // Provide more detailed error feedback based on the error type
    if (error instanceof Error) {
      if (error.message.includes('token limit')) {
        return NextResponse.json({ 
          error: 'Token limit exceeded - try with a shorter prompt or smaller context' 
        }, { status: 400 });
      } else if (error.message.includes('API key') || error.message.includes('authentication')) {
        return NextResponse.json({ 
          error: 'Azure OpenAI API authentication failed - check API key configuration' 
        }, { status: 500 });
      } else if (error.message.includes('rate limit')) {
        return NextResponse.json({ 
          error: 'Rate limit exceeded - try again later' 
        }, { status: 429 });
      } else if (error.message.includes('cycle')) {
        return NextResponse.json({ 
          error: 'Pipeline graph contains cycles - please fix the pipeline structure' 
        }, { status: 400 });
      }
      
      return NextResponse.json({ error: `Failed to run pipeline: ${error.message}` }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Failed to run pipeline due to an unknown error' }, { status: 500 });
  }
}
