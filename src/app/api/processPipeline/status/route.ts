import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getFirestore } from '@/lib/firebase-admin';

// Define the pipeline status interface
export interface PipelineStatus {
  stage: 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';
  progress: number;
  error?: string;
  totalChunks?: number;
  processedChunks?: number;
  startTime?: number;
  endTime?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    
    // Get pipelineId from query params
    const url = new URL(request.url);
    const pipelineId = url.searchParams.get('pipelineId');
    
    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }
    
    // Set up SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ connected: true })}\n\n`));
        
        // Set up Firestore listener for pipeline status updates
        const db = await getFirestore();
        const pipelineRef = db.collection('pipelines').doc(pipelineId);
        
        // First, get the current status
        const doc = await pipelineRef.get();
        if (!doc.exists) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Pipeline not found' })}\n\n`));
          controller.close();
          return;
        }
        
        const data = doc.data();
        if (data?.status) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.status)}\n\n`));
          
          // If the pipeline is already complete, close the stream
          if (data.status.stage === 'complete' || data.status.error) {
            controller.close();
            return;
          }
        }
        
        // Set up real-time listener for updates
        const unsubscribe = pipelineRef.onSnapshot((snapshot) => {
          if (snapshot.exists) {
            const data = snapshot.data();
            if (data?.status) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data.status)}\n\n`));
              
              // Close the stream if the pipeline is complete or has an error
              if (data.status.stage === 'complete' || data.status.error) {
                unsubscribe();
                controller.close();
              }
            }
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Pipeline deleted' })}\n\n`));
            unsubscribe();
            controller.close();
          }
        }, (error) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
          controller.close();
        });
        
        // Handle client disconnection
        request.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });
      }
    });
    
    // Return the stream as an SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error streaming pipeline status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stream pipeline status' },
      { status: 500 }
    );
  }
}

// Fallback polling endpoint for browsers that don't support SSE
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    
    const body = await request.json();
    const { pipelineId } = body;
    
    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }
    
    // Get pipeline status from Firestore
    const db = await getFirestore();
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    const doc = await pipelineRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }
    
    const data = doc.data();
    return NextResponse.json(data?.status || { stage: 'uploading', progress: 0 });
  } catch (error) {
    console.error('Error getting pipeline status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get pipeline status' },
      { status: 500 }
    );
  }
}
