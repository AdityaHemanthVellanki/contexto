import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getFirestore } from '@/lib/firebase-admin';

/**
 * GET handler for polling pipeline status
 * This is a fallback for when SSE connections fail
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pipelineId from query params
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    if (!pipelineId) {
      return NextResponse.json({ error: 'Missing pipelineId parameter' }, { status: 400 });
    }

    // Get pipeline status from Firestore
    const db = await getFirestore();
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();

    if (!pipelineDoc.exists) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const pipelineData = pipelineDoc.data();
    
    if (!pipelineData) {
      return NextResponse.json({ error: 'Pipeline data not found' }, { status: 404 });
    }

    // Return the pipeline status
    return NextResponse.json({
      stage: pipelineData.stage || 'uploading',
      progress: pipelineData.progress || 0,
      error: pipelineData.error || null,
      totalChunks: pipelineData.totalChunks || null,
      processedChunks: pipelineData.processedChunks || null
    });
  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline status' }, { status: 500 });
  }
}
