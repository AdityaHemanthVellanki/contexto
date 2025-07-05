import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { db } from '@/utils/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
    const { inputs } = await request.json();
    
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
    
    // In a real implementation, you would execute the pipeline here
    // For now, we'll just return a mock result as in the original function
    const result = {
      success: true,
      outputs: {
        message: 'Pipeline execution completed successfully',
        results: inputs || {}
      }
    };
    
    // Log usage
    await addDoc(collection(db, 'usage_metrics'), {
      userId,
      callType: 'pipeline_execution',
      promptTokens: 100, // Example values
      completionTokens: 50, // Example values
      timestamp: serverTimestamp()
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error running pipeline:', error);
    return NextResponse.json({ error: 'Failed to run pipeline' }, { status: 500 });
  }
}
