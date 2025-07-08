import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { db } from '@/utils/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

// Helper to verify pipeline ownership
async function verifyPipelineOwnership(pipelineId: string, userId: string) {
  const pipelineRef = doc(db, 'pipelines', pipelineId);
  const pipelineDoc = await getDoc(pipelineRef);
  
  if (!pipelineDoc.exists()) {
    return { exists: false, owned: false, data: null };
  }
  
  const pipelineData = pipelineDoc.data();
  const isOwner = pipelineData.userId === userId;
  
  return { exists: true, owned: isOwner, data: pipelineData };
}

// GET handler for retrieving a specific pipeline
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const pipelineId = params.id;
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    const ownership = await verifyPipelineOwnership(pipelineId, userId!);
    
    if (!ownership.exists) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    
    if (!ownership.owned) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    return NextResponse.json({
      id: pipelineId,
      ...ownership.data
    });
  } catch (error: any) {
    console.error('Error getting pipeline:', error);
    return NextResponse.json({ error: 'Failed to get pipeline' }, { status: 500 });
  }
}

// DELETE handler for soft-deleting a pipeline
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const pipelineId = params.id;
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    const ownership = await verifyPipelineOwnership(pipelineId, userId!);
    
    if (!ownership.exists) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }
    
    if (!ownership.owned) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Soft delete by marking as deleted
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    await updateDoc(pipelineRef, {
      deleted: true,
      updatedAt: serverTimestamp()
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json({ error: 'Failed to delete pipeline' }, { status: 500 });
  }
}
