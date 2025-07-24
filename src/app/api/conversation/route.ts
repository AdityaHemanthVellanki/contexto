import { NextRequest, NextResponse } from 'next/server';
import { ConversationServerService } from '@/services/conversation-server';
// Import directly from our shared Firebase Admin initialization module
import { initializeFirebaseAdmin, getFirebaseAuth } from '@/lib/firebase-admin-init';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for conversation API');
} catch (error) {
  console.error('❌ Firebase initialization failed in conversation API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

// Firebase is already initialized at module level above
// No need for additional initialization here

// Define a type for Firebase errors
type FirebaseError = {
  code?: string;
  message?: string;
  stack?: string;
};

// Helper function to log detailed error information
function logDetailedError(error: unknown, context: string) {
  console.error(`Conversation API error in ${context}:`, error);
  
  // Type guard for error objects
  if (error && typeof error === 'object') {
    const firebaseError = error as FirebaseError;
    console.error('Error code:', firebaseError.code || 'no_code');
    console.error('Error message:', firebaseError.message || 'no_message');
    if (firebaseError.stack) {
      console.error('Error stack:', firebaseError.stack);
    }
  } else {
    console.error('Unknown error type:', typeof error);
  }
}

// Helper function to verify Firestore connection
async function verifyFirestoreConnection() {
  try {
    // Get the Firestore instance directly from our shared module
    const db = initializeFirebaseAdmin();
    // Try a simple operation to verify connection
    const testDoc = await db.collection('_connection_test').doc('test').get();
    return { connected: true };
  } catch (error: unknown) {
    logDetailedError(error, 'verifyFirestoreConnection');
    return { connected: false, error: error as FirebaseError };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Firebase is already initialized at module level
    
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Firestore connection first
    const connectionStatus = await verifyFirestoreConnection();
    if (!connectionStatus.connected) {
      return NextResponse.json({ 
        error: 'Database connection error', 
        details: 'Could not connect to Firestore' 
      }, { status: 500 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    let decodedToken;
    try {
      // Ensure Firebase is initialized first
      // Firebase is already initialized at module level
      // Get the Auth instance directly from Firebase Admin
      const auth = getFirebaseAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      logDetailedError(error, 'token verification');
      return NextResponse.json({ 
        error: 'Authentication error', 
        details: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    const userId = decodedToken.uid;

    const body = await request.json();
    const { action, sessionId, userInput } = body;

    switch (action) {
      case 'create_session':
        try {
          const session = await ConversationServerService.createSession(userId);
          return NextResponse.json({ session });
        } catch (error: unknown) {
          logDetailedError(error, 'create_session');
          const firebaseError = error as FirebaseError;
          return NextResponse.json({ 
            error: 'Failed to create session',
            code: firebaseError.code || 'unknown',
            message: firebaseError.message || 'An unexpected error occurred'
          }, { status: 500 });
        }

      case 'get_session':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        try {
          const existingSession = await ConversationServerService.getSession(sessionId);
          return NextResponse.json({ session: existingSession });
        } catch (error: unknown) {
          logDetailedError(error, 'get_session');
          const firebaseError = error as FirebaseError;
          return NextResponse.json({ 
            error: 'Failed to get session',
            code: firebaseError.code || 'unknown',
            message: firebaseError.message || 'An unexpected error occurred'
          }, { status: 500 });
        }

      case 'get_active_session':
        try {
          const activeSession = await ConversationServerService.getActiveSession(userId);
          return NextResponse.json({ session: activeSession });
        } catch (error: unknown) {
          logDetailedError(error, 'get_active_session');
          const firebaseError = error as FirebaseError;
          return NextResponse.json({ 
            error: 'Failed to get active session',
            code: firebaseError.code || 'unknown',
            message: firebaseError.message || 'An unexpected error occurred'
          }, { status: 500 });
        }

      case 'process_input':
        if (!sessionId || !userInput) {
          return NextResponse.json({ error: 'Session ID and user input required' }, { status: 400 });
        }
        
        try {
          // Add user message to conversation
          await ConversationServerService.addMessage(sessionId, {
            role: 'user',
            content: userInput
          });

          // Process input and get response
          const response = await ConversationServerService.processUserInput(sessionId, userInput);
          
          // Add assistant response to conversation
          await ConversationServerService.addMessage(sessionId, {
            role: 'assistant',
            content: response.error ? 
              `${response.error}\n\n${response.nextQuestion}` : 
              response.nextQuestion,
            metadata: {
              isValid: !response.error,
              error: response.error
            }
          });

          return NextResponse.json(response);
        } catch (error: unknown) {
          logDetailedError(error, 'process_input');
          const firebaseError = error as FirebaseError;
          return NextResponse.json({ 
            error: 'Failed to process input',
            code: firebaseError.code || 'unknown',
            message: firebaseError.message || 'An unexpected error occurred'
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: unknown) {
    logDetailedError(error, 'main handler');
    const firebaseError = error as FirebaseError;
    return NextResponse.json({
      error: 'Internal server error',
      code: firebaseError.code || 'unknown',
      message: firebaseError.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase is initialized before processing the request
    // Firebase is already initialized at module level
    
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    let decodedToken;
    try {
      // Ensure Firebase is initialized first
      // Firebase is already initialized at module level
      // Get the Auth instance directly from Firebase Admin
      const auth = getFirebaseAuth();
      decodedToken = await auth.verifyIdToken(token);
    } catch (error: unknown) {
      logDetailedError(error, 'GET token verification');
      return NextResponse.json({ 
        error: 'Authentication error', 
        details: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    const userId = decodedToken.uid;

    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    try {
      const session = await ConversationServerService.getSession(sessionId);
      return NextResponse.json({ session });
    } catch (error: unknown) {
      logDetailedError(error, 'GET session');
      const firebaseError = error as FirebaseError;
      return NextResponse.json({ 
        error: 'Failed to get session',
        code: firebaseError.code || 'unknown',
        message: firebaseError.message || 'An unexpected error occurred'
      }, { status: 500 });
    }
  } catch (error: unknown) {
    logDetailedError(error, 'GET main handler');
    const firebaseError = error as FirebaseError;
    return NextResponse.json({
      error: 'Internal server error',
      code: firebaseError.code || 'unknown',
      message: firebaseError.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
}
