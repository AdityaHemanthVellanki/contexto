import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { generateChatCompletion } from '@/lib/azure-openai';
import { queryEmbeddings } from '@/lib/pinecone-client';
import { generateEmbeddings } from '@/lib/azure-openai';
import { collection, addDoc, doc, getDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { z } from 'zod';

// Request schema validation
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  chatId: z.string().optional(),
  pipelineId: z.string().optional(),
  context: z.string().optional()
});

interface ChatRequest {
  message: string;
  chatId?: string;
  pipelineId?: string;
  context?: string;
}

/**
 * POST /api/chat - Send chat message with RAG integration
 */
export const POST = withAuth(async (req) => {
  try {
    const body: ChatRequest = await req.json();
    const validation = ChatRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const { message, chatId, pipelineId, context } = validation.data;
    
    // Generate embedding for the user's message
    const messageEmbedding = await generateEmbeddings(message);
    
    // Retrieve relevant context from vector store if pipelineId provided
    let relevantContext = '';
    if (pipelineId) {
      try {
        // Create index name from userId and pipelineId
        const indexName = `ctx-${req.userId.toLowerCase()}-${pipelineId.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-');
        const searchResults = await queryEmbeddings(indexName, messageEmbedding, 5);
        relevantContext = searchResults
          .map(result => result.metadata?.text || '')
          .filter(text => text.length > 0)
          .join('\n\n');
      } catch (error) {
        console.warn('Failed to retrieve context from vector store:', error);
      }
    }
    
    // Build conversation history
    let conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are a helpful AI assistant. ${context || ''} ${relevantContext ? `\n\nRelevant context from uploaded documents:\n${relevantContext}` : ''}`
      }
    ];
    
    // Add recent chat history if chatId provided
    if (chatId) {
      try {
        const messagesRef = collection(db, 'users', req.userId, 'chats', chatId, 'messages');
        const recentMessages = await getDocs(
          query(messagesRef, orderBy('timestamp', 'desc'), limit(10))
        );
        
        const history = recentMessages.docs
          .reverse()
          .map(doc => {
            const data = doc.data();
            // Ensure the message has the correct structure
            return {
              role: data.role as 'user' | 'assistant' | 'system',
              content: data.content as string
            };
          })
          .filter(msg => msg.role !== 'system');
        
        conversationHistory.push(...history);
      } catch (error) {
        console.warn('Failed to load chat history:', error);
      }
    }
    
    // Add current user message
    conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // Generate AI response
    const aiResponse = await generateChatCompletion(conversationHistory, 'gpt4', false);
    const assistantMessage = aiResponse.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    // Save messages to Firestore if chatId provided
    if (chatId) {
      try {
        const messagesRef = collection(db, 'users', req.userId, 'chats', chatId, 'messages');
        
        // Save user message
        await addDoc(messagesRef, {
          role: 'user',
          content: message,
          timestamp: new Date(),
          pipelineId: pipelineId || null
        });
        
        // Save assistant message
        await addDoc(messagesRef, {
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date(),
          pipelineId: pipelineId || null,
          hasContext: !!relevantContext
        });
        
        // Update chat metadata
        const chatDocRef = doc(db, 'users', req.userId, 'chats', chatId);
        await addDoc(collection(db, 'users', req.userId, 'chats'), {
          lastMessage: assistantMessage.substring(0, 100),
          lastMessageAt: new Date(),
          messageCount: (await getDocs(messagesRef)).size
        });
      } catch (error) {
        console.warn('Failed to save chat messages:', error);
      }
    }
    
    return successResponse({
      message: assistantMessage,
      hasContext: !!relevantContext,
      contextLength: relevantContext.length,
      chatId
    });
  } catch (error) {
    console.error('Chat error:', error);
    return errorResponse('Failed to process chat message', 500);
  }
});

/**
 * GET /api/chat - List user's chats
 */
export const GET = withAuth(async (req) => {
  try {
    const chatsRef = collection(db, 'users', req.userId, 'chats');
    const chatsSnapshot = await getDocs(query(chatsRef, orderBy('lastMessageAt', 'desc')));
    
    const chats = chatsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lastMessageAt: doc.data().lastMessageAt?.toDate?.()?.toISOString() || doc.data().lastMessageAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));
    
    return successResponse({
      chats,
      count: chats.length
    });
  } catch (error) {
    console.error('Chat listing error:', error);
    return errorResponse('Failed to list chats', 500);
  }
});
