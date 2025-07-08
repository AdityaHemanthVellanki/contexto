import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { db } from '@/utils/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

// GET handler for listing pipelines
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    
    const pipelinesQuery = query(
      collection(db, 'pipelines'),
      where('userId', '==', userId),
      where('deleted', '==', false),
      orderBy('updatedAt', 'desc')
    );
    
    const pipelinesSnapshot = await getDocs(pipelinesQuery);
    
    const pipelines: any[] = [];
    pipelinesSnapshot.forEach((doc) => {
      pipelines.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return NextResponse.json({ pipelines });
  } catch (error: any) {
    console.error('Error listing pipelines:', error);
    return NextResponse.json({ error: 'Failed to list pipelines' }, { status: 500 });
  }
}

// POST handler for creating/updating pipelines
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    const { id, name, graph } = await request.json();
    
    if (!name || !graph) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const timestamp = serverTimestamp();
    let pipelineId = id;
    
    if (id) {
      // Update existing pipeline
      const pipelineRef = doc(db, 'pipelines', id);
      
      // Verify ownership
      const pipelineDoc = await getDoc(pipelineRef);
      if (pipelineDoc.exists()) {
        const pipelineData = pipelineDoc.data();
        if (pipelineData.userId !== userId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
      }
      
      await updateDoc(pipelineRef, {
        name,
        graph,
        updatedAt: timestamp
      });
    } else {
      // Create new pipeline
      pipelineId = doc(collection(db, 'pipelines')).id;
      const pipelineRef = doc(db, 'pipelines', pipelineId);
      
      await setDoc(pipelineRef, {
        userId,
        name,
        graph,
        createdAt: timestamp,
        updatedAt: timestamp,
        deleted: false
      });
    }
    
    return NextResponse.json({ id: pipelineId });
  } catch (error: any) {
    console.error('Error saving pipeline:', error);
    return NextResponse.json({ error: 'Failed to save pipeline' }, { status: 500 });
  }
}
