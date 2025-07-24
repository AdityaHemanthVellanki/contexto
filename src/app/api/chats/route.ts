import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { getFirebaseAuth } from '@/lib/firebase-admin-init';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for chats API');
} catch (error) {
  console.error('❌ Firebase initialization failed in chats API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 20,
      windowSizeInSeconds: 60
    });
    
    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found' }, { status: 400 });
    }

    // Get user's chat sessions
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const chatsRef = db.collection('conversations').doc(userId).collection('chats');
    const snapshot = await chatsRef.orderBy('updatedAt', 'desc').get();
    
    // Add proper type for the doc parameter
    const chats = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data()
    }));

    const response = NextResponse.json({ chats });
    
    // Add rate limit headers
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { message: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      windowSizeInSeconds: 60
    });
    
    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found' }, { status: 400 });
    }

    // Parse request body
    const { title = 'New Chat' } = await request.json();

    // Create new chat
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const chatRef = db.collection('conversations').doc(userId).collection('chats').doc();
    await chatRef.set({
      title: title.trim(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      messageCount: 0
    });

    const response = NextResponse.json({ 
      chatId: chatRef.id,
      message: 'Chat created successfully' 
    });
    
    // Add rate limit headers
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { message: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
