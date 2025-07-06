import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Logs API usage metrics to Firestore
 * 
 * @param callType Type of API call (embed, summarizer, ragQuery, refine)
 * @param usage Token usage statistics
 */
export async function logUsage(
  callType: string, 
  usage: { 
    promptTokens: number; 
    completionTokens: number; 
  }
) {
  try {
    const db = getFirestore();
    const auth = getAuth();
    const userId = auth.currentUser?.uid || 'anonymous';

    // Create usage metrics document
    await addDoc(collection(db, 'usage_metrics'), {
      userId,
      callType,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.promptTokens + usage.completionTokens,
      timestamp: serverTimestamp()
    });

    console.log(`Usage logged for ${callType}: ${usage.promptTokens + usage.completionTokens} tokens`);
  } catch (error) {
    // Log but don't throw - we don't want usage tracking to block the main functionality
    console.error('Error logging usage metrics:', error);
  }
}
