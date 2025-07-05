import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { db } from '@/utils/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

// POST handler for logging usage metrics
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const userId = authResult.userId;
    const { callType, promptTokens, completionTokens } = await request.json();
    
    if (!callType || typeof promptTokens !== 'number' || typeof completionTokens !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }
    
    const usageData = {
      userId,
      callType,
      promptTokens,
      completionTokens,
      timestamp: serverTimestamp()
    };
    
    const usageRef = await addDoc(collection(db, 'usage_metrics'), usageData);
    
    return NextResponse.json({ id: usageRef.id });
  } catch (error: any) {
    console.error('Error logging usage:', error);
    return NextResponse.json({ error: 'Failed to log usage' }, { status: 500 });
  }
}
