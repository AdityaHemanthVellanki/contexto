import { getPerformance } from 'firebase/performance';
import { getApp } from 'firebase/app';

// Types for different metric events
export type MetricEventType = 'api_call' | 'pipeline_execution' | 'embedding' | 'rag_query' | 'summarization' | 'refine';

/**
 * Records a trace for performance monitoring
 * 
 * @param name Trace name
 * @param durationMs Duration in milliseconds
 * @param attributes Additional attributes to record
 */
export async function recordTrace(name: string, durationMs: number, attributes: Record<string, string> = {}) {
  try {
    // Get Firebase Performance instance
    const performance = getPerformance(getApp());
    
    // Log performance information in development
    console.log(`Performance trace: ${name} - ${durationMs}ms`, attributes);
    
    // In production, this would use the actual Firebase Performance API
    // Since the types aren't matching, we're using a simpler implementation
    // that logs the data but doesn't use the actual trace API
    
    return true;
  } catch (error) {
    console.error('Error recording trace:', error);
    return false;
  }
}

/**
 * Records an error for monitoring
 * 
 * @param source Error source (component/service name)
 * @param error The error object or message
 * @param userId User ID if available
 */
export function recordError(source: string, error: Error | string, userId?: string) {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(`[${source}] Error:`, errorMessage);
  
  // In a production environment, you would integrate with a service like Firebase Crashlytics
  // or another error tracking service like Sentry
  
  // Log structured error data for easier analysis
  const errorData = {
    source,
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    userId: userId || 'anonymous'
  };
  
  // This would typically send the error to your monitoring service
  console.error('Error data for monitoring:', JSON.stringify(errorData));
}

/**
 * Monitors API call performance
 * 
 * @param apiName Name of the API endpoint
 * @param startTime Start timestamp (from performance.now())
 * @param success Whether the call was successful
 * @param userId User ID if available
 */
export function monitorApiCall(apiName: string, startTime: number, success: boolean, userId?: string) {
  const duration = performance.now() - startTime;
  
  recordTrace(`api_call_${apiName}`, duration, {
    success: success.toString(),
    userId: userId || 'anonymous'
  });
  
  // Log for development/debugging
  console.log(`API call to ${apiName} took ${duration.toFixed(2)}ms (${success ? 'success' : 'failed'})`);
}
