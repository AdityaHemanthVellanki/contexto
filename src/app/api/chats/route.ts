import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
    const db = getFirestore();
    const chatsRef = db.collection('conversations').doc(userId).collection('chats');
    const snapshot = await chatsRef.orderBy('updatedAt', 'desc').get();
    
    const chats = snapshot.docs.map(doc => ({
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
    const db = getFirestore();
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
