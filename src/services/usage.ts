import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
 * @throws Error if Firestore operation fails or if parameters are missing
 */
export async function logUsage(
  callType: string, 
  usage: TokenUsage,
  userId: string
): Promise<void> {
  // Validate required parameters
  if (!callType) {
    throw new Error('Call type is required for usage logging');
  }
  
  if (!usage || typeof usage.promptTokens !== 'number' || typeof usage.completionTokens !== 'number') {
    throw new Error('Valid token usage metrics are required for usage logging');
  }
  
  if (!userId) {
    throw new Error('User ID is required for usage logging');
  }
  
  try {
    // Create usage metrics document with required user isolation
    await addDoc(collection(db, 'usage_metrics'), {
      userId,
      callType,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    // In production, we throw errors for proper handling
    if (error instanceof Error) {
      throw new Error(`Failed to log usage metrics: ${error.message}`);
    }
    throw new Error('Failed to log usage metrics: Unknown error');
  }
}
