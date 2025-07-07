import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/utils/firebase-admin';
import { runRefineAnswer } from '@/services/refineAnswer';
import { refineSchema, validate } from '@/utils/validation';
import { monitorApiCall } from '@/utils/monitoring';

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

// POST handler for refining text
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  let success = false;
  let userId: string | null = null;
  
  try {
    // Step 1: Authenticate the request
    const authResult = await authenticateRequest(request);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    
    userId = authResult.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    
    // Step 2: Parse and validate the request body
    const body = await request.json();
    const validationResult = validate(refineSchema, body);
    
    if (!validationResult.success) {
      return NextResponse.json({ error: `Validation error: ${validationResult.error}` }, { status: 400 });
    }
    
    const { text, instructions } = validationResult.data;
    
    // Default instructions if none provided
    const refinementInstructions = instructions || 'Improve this text to make it more clear, concise, and well-structured.';
    
    // Step 3: Call the refine answer service
    const refinedText = await runRefineAnswer(text, refinementInstructions, userId);
    
    success = true;
    return NextResponse.json({
      success: true,
      text: refinedText
    });
  } catch (error: any) {
    console.error('Error refining text:', error);
    success = false;
    
    // Provide more detailed error feedback
    if (error instanceof Error) {
      if (error.message.includes('token limit')) {
        return NextResponse.json({ 
          error: 'Token limit exceeded - try with a shorter text' 
        }, { status: 400 });
      } else if (error.message.includes('API key') || error.message.includes('authentication')) {
        return NextResponse.json({ 
          error: 'Azure OpenAI API authentication failed - check API key configuration' 
        }, { status: 500 });
      } else if (error.message.includes('rate limit')) {
        return NextResponse.json({ 
          error: 'Rate limit exceeded - try again later' 
        }, { status: 429 });
      }
      
      return NextResponse.json({ error: `Failed to refine text: ${error.message}` }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Failed to refine text due to an unknown error' }, { status: 500 });
  } finally {
    // Record API call performance
    const duration = performance.now() - startTime;
    monitorApiCall('refine', startTime, success, userId || undefined);
    
    console.log(`Refine API call completed in ${duration.toFixed(2)}ms (success: ${success})`);
  }
}
