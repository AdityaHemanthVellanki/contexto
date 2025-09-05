import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { z } from 'zod';

// Update chat schema
const UpdateChatSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
});

/**
 * GET /api/chat/[chatId] - Get chat details and messages
 */
export const GET = withAuth<{ chatId: string }>(async (req, context) => {
  const { chatId } = context?.params || {};
  
  if (!chatId) {
    return errorResponse('Chat ID is required', 400);
  }
  try {
    // chatId is already extracted from context.params above
    
    // Get chat metadata
    const chatDocRef = doc(db, 'users', req.userId, 'chats', chatId);
    const chatDoc = await getDoc(chatDocRef);
    
    if (!chatDoc.exists()) {
      return errorResponse('Chat not found', 404);
    }
    
    // Get chat messages
    const messagesRef = collection(db, 'users', req.userId, 'chats', chatId, 'messages');
    const messagesSnapshot = await getDocs(query(messagesRef, orderBy('timestamp', 'asc')));
    
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
    }));
    
    const chatData = chatDoc.data();
    
    return successResponse({
      id: chatDoc.id,
      ...chatData,
      createdAt: chatData.createdAt?.toDate?.()?.toISOString() || chatData.createdAt,
      lastMessageAt: chatData.lastMessageAt?.toDate?.()?.toISOString() || chatData.lastMessageAt,
      messages
    });
  } catch (error) {
    console.error('Get chat error:', error);
    return errorResponse('Failed to get chat', 500);
  }
});

/**
 * PATCH /api/chat/[chatId] - Update chat metadata
 */
export const PATCH = withAuth<{ chatId: string }>(async (req, context) => {
  const { chatId } = context?.params || {};
  
  if (!chatId) {
    return errorResponse('Chat ID is required', 400);
  }
  try {
    // chatId is already extracted from context.params above
    const body = await req.json();
    const validation = UpdateChatSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const chatDocRef = doc(db, 'users', req.userId, 'chats', chatId);
    const chatDoc = await getDoc(chatDocRef);
    
    if (!chatDoc.exists()) {
      return errorResponse('Chat not found', 404);
    }
    
    const updateData = {
      ...validation.data,
      updatedAt: new Date()
    };
    
    await updateDoc(chatDocRef, updateData);
    
    return successResponse({
      message: 'Chat updated successfully',
      chatId
    });
  } catch (error) {
    console.error('Update chat error:', error);
    return errorResponse('Failed to update chat', 500);
  }
});

/**
 * DELETE /api/chat/[chatId] - Delete chat and all messages
 */
export const DELETE = withAuth<{ chatId: string }>(async (req, context) => {
  const { chatId } = context?.params || {};
  
  if (!chatId) {
    return errorResponse('Chat ID is required', 400);
  }
  try {
    const chatDocRef = doc(db, 'users', req.userId, 'chats', chatId);
    const chatDoc = await getDoc(chatDocRef);
    
    if (!chatDoc.exists()) {
      return errorResponse('Chat not found', 404);
    }
    
    // Delete all messages in the chat
    const messagesRef = collection(db, 'users', req.userId, 'chats', chatId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Delete the chat document
    await deleteDoc(chatDocRef);
    
    return successResponse({
      message: 'Chat deleted successfully',
      chatId
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    return errorResponse('Failed to delete chat', 500);
  }
});
