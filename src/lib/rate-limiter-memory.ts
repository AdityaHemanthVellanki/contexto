import { NextRequest, NextResponse } from 'next/server';

/**
 * Interface for rate limit options
 */
export interface RateLimitOptions {
  limit: number;
  windowSizeInSeconds: number;
  identifierFn?: (req: NextRequest) => string;
}

/**
 * Interface for rate limit result
 */
export interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
  headers?: Record<string, string>;
}

// In-memory storage for rate limiting
// Note: This will reset when the serverless function cold starts
// For production use with high traffic, consider a more persistent solution
type RateLimitData = {
  count: number;
  resetTime: number;
};

// Using a Map for in-memory storage
const rateLimitStore = new Map<string, RateLimitData>();

// Clean up expired entries periodically to prevent memory leaks
// This is especially important in a long-running environment
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * In-memory rate limiting middleware for Next.js API routes
 * Warning: This is suitable for low-traffic applications or development.
 * For high-traffic production environments, consider a distributed solution.
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = { limit: 20, windowSizeInSeconds: 10 }
): Promise<RateLimitResult> {
  try {
    // Get client identifier (forwarded IP or headers by default)
    const identifier = options.identifierFn 
      ? options.identifierFn(req) 
      : (req.headers.get('x-forwarded-for') || 
         req.headers.get('x-real-ip') || 
         'unknown-ip');
    
    // Add endpoint to make rate limiting specific to each API endpoint
    const endpoint = new URL(req.url).pathname;
    const key = `rate_limit:${identifier}:${endpoint}`;
    
    const now = Date.now();
    const windowSize = options.windowSizeInSeconds * 1000;
    
    // Get the current rate limit data for this client/endpoint
    const data = rateLimitStore.get(key);
    
    if (!data || data.resetTime < now) {
      // Initialize rate limit data for this client/endpoint
      rateLimitStore.set(
        key, 
        { count: 1, resetTime: now + windowSize }
      );
      
      // Schedule cleanup for this entry
      setTimeout(() => {
        rateLimitStore.delete(key);
      }, windowSize);
      
      return { 
        limited: false,
        headers: {
          'X-RateLimit-Limit': options.limit.toString(),
          'X-RateLimit-Remaining': (options.limit - 1).toString(),
          'X-RateLimit-Reset': Math.ceil((now + windowSize) / 1000).toString()
        }
      };
    }
    
    // Increment the request count
    const newCount = data.count + 1;
    
    if (newCount > options.limit) {
      // Calculate remaining time until rate limit reset
      const retryAfter = Math.ceil((data.resetTime - now) / 1000);
      
      // Return a 429 Too Many Requests response
      return {
        limited: true,
        response: NextResponse.json(
          { 
            message: 'Too Many Requests', 
            retryAfter,
            error: 'rate_limited' 
          },
          { 
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': options.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
            }
          }
        ),
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': options.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
        }
      };
    }
    
    // Update the count in the Map
    rateLimitStore.set(
      key,
      { count: newCount, resetTime: data.resetTime }
    );
    
    // Return success with updated headers
    return { 
      limited: false,
      headers: {
        'X-RateLimit-Limit': options.limit.toString(),
        'X-RateLimit-Remaining': (options.limit - newCount).toString(),
        'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000).toString()
      }
    };
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Fail open - don't block requests if rate limiting fails
    return { limited: false };
  }
}
