import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UsageReport } from '../handlers/openai';

/**
 * Logs API usage to Firestore for billing and monitoring
 * @param userId User ID for the request
 * @param callType Type of API call (embedding, summarization, rag, refine)
 * @param usage Usage statistics from the API call
 * @returns The document reference for the logged usage
 */
export const logUsage = async (
  userId: string,
  callType: string,
  usage: UsageReport
) => {
  try {
    // Validate inputs
    if (!userId) {
      throw new Error('User ID is required for usage logging');
    }

    // Prepare usage data
    const usageData = {
      userId,
      callType,
      tokenUsage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens
      },
      model: usage.model,
      operation: usage.operation,
      timestamp: serverTimestamp(),
      billingStatus: 'pending' // Can be updated by a billing system
    };

    // Log to Firestore
    const usageCollection = collection(db, 'usage');
    const docRef = await addDoc(usageCollection, usageData);
    
    console.log(`Usage logged: ${docRef.id} for user ${userId}`);
    return docRef;
  } catch (error) {
    // Log error but don't fail the entire operation
    const message = error instanceof Error ? error.message : 'Unknown error in logUsage';
    console.error(`Failed to log usage: ${message}`, error);
    
    // Rethrow in production for proper error handling
    throw new Error(`Usage logging failed: ${message}`);
  }
};

/**
 * Aggregates multiple usage reports into a single report
 * @param reports Array of usage reports to aggregate
 * @returns Aggregated usage report
 */
export const aggregateUsage = (reports: UsageReport[]): UsageReport => {
  if (!reports || reports.length === 0) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: 'none',
      operation: 'none'
    };
  }

  // Single report case
  if (reports.length === 1) {
    return { ...reports[0] };
  }

  // Multiple reports case
  return reports.reduce(
    (acc, curr) => ({
      promptTokens: acc.promptTokens + curr.promptTokens,
      completionTokens: acc.completionTokens + curr.completionTokens,
      totalTokens: acc.totalTokens + curr.totalTokens,
      model: `${acc.model},${curr.model}`,
      operation: `${acc.operation},${curr.operation}`
    }),
    {
      promptTokens: 0,
      completionTokens: 0, 
      totalTokens: 0,
      model: '',
      operation: ''
    }
  );
};
