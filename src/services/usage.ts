import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Token usage metrics interface
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Logs API usage metrics to Firestore
 * 
 * @param callType Type of API call (embed, summarizer, ragQuery, refine)
 * @param usage Token usage statistics
 * @param userId Authenticated user ID
 * @returns Promise that resolves when logging is complete or fails gracefully
 */
export async function logUsage(
  callType: string, 
  usage: TokenUsage,
  userId: string
): Promise<void> {
  // Quick validation (but don't throw errors)
  if (!callType || !usage || !userId) {
    console.warn('Missing parameters for usage logging');
    return;
  }
  
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  try {
    if (isBrowser) {
      // Client-side Firebase SDK
      try {
        await addDoc(collection(db, 'usage_metrics'), {
          userId,
          callType,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.promptTokens + usage.completionTokens,
          timestamp: serverTimestamp(),
          environment: 'client'
        });
      } catch (clientError) {
        // Log error but don't throw - client logging should not block execution
        console.warn(`Client-side usage logging failed: ${clientError instanceof Error ? clientError.message : 'Unknown error'}`);
      }
    } else {
      // Server-side Firebase Admin SDK
      try {
        const adminDb = getFirestore();
        await adminDb.collection('usage_metrics').add({
          userId,
          callType,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.promptTokens + usage.completionTokens,
          timestamp: FieldValue.serverTimestamp(),
          environment: 'server'
        });
      } catch (serverError) {
        // Log error but don't throw - server logging should not block execution
        console.warn(`Server-side usage logging failed: ${serverError instanceof Error ? serverError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    // Super safety catch - never throw errors from logging
    console.warn(`Usage logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
