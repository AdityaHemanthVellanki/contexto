import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { logUsage } from '@/services/usage';

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
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    
    const { callType, promptTokens, completionTokens } = await request.json();
    
    if (!callType || typeof promptTokens !== 'number' || typeof completionTokens !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }
    
    // Use the updated logUsage service function
    await logUsage(
      callType, 
      { promptTokens, completionTokens },
      userId
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error logging usage:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: `Failed to log usage: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to log usage due to an unknown error' }, { status: 500 });
  }
}
