import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for chats/[chatId] API');
} catch (error) {
  console.error('❌ Firebase initialization failed in chats/[chatId] API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

interface RouteParams {
  params: {
    chatId: string;
  };
}

function getClientIp(req: Request): string {
  const xfwd = req.headers.get('x-forwarded-for') || '';
  const real = req.headers.get('x-real-ip') || '';
  const ip = (xfwd.split(',')[0] || real || '').trim();
  return ip || 'unknown';
}

export async function PATCH(request: Request, { params }: any) {
  try {
    // Apply rate limiting using client IP and chat ID as identifier
    const identifier = `chats:patch:${params.chatId}:ip:${getClientIp(request)}`;
    const rateLimitResult = await rateLimit(identifier, { limit: 10, windowSizeInSeconds: 60 });
    
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

    const { chatId } = params;
    const { title } = await request.json();

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Valid title is required' }, { status: 400 });
    }

    // Update chat title
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const chatRef = db.collection('conversations').doc(userId).collection('chats').doc(chatId);
    
    // Check if chat exists and belongs to user
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    await chatRef.update({
      title: title.trim(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const response = NextResponse.json({ 
      message: 'Chat updated successfully',
      chatId,
      title: title.trim()
    });
    
    // Add rate limit headers
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (error) {
    console.error('Error updating chat:', error);
    return NextResponse.json(
      { message: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: any) {
  try {
    // Apply rate limiting using client IP and chat ID as identifier
    const identifier = `chats:delete:${params.chatId}:ip:${getClientIp(request)}`;
    const rateLimitResult = await rateLimit(identifier, { limit: 10, windowSizeInSeconds: 60 });
    
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

    const { chatId } = params;

    // Delete chat and all associated messages
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const chatRef = db.collection('conversations').doc(userId).collection('chats').doc(chatId);
    
    // Check if chat exists and belongs to user
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
      return NextResponse.json({ message: 'Chat not found' }, { status: 404 });
    }

    // Delete all messages in the chat
    const messagesRef = chatRef.collection('messages');
    const messagesSnapshot = await messagesRef.get();
    
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    // Delete the chat document itself
    batch.delete(chatRef);
    
    await batch.commit();

    const response = NextResponse.json({ 
      message: 'Chat deleted successfully',
      chatId
    });
    
    // Add rate limit headers
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { message: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
