import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface RouteParams {
  params: {
    chatId: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { chatId } = params;
    const { title } = await request.json();

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Valid title is required' }, { status: 400 });
    }

    // Update chat title
    const db = getFirestore();
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { chatId } = params;

    // Delete chat and all associated messages
    const db = getFirestore();
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
