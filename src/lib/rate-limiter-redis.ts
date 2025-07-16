import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client with environment variables
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

interface RateLimitOptions {
  limit: number;
  windowSizeInSeconds: number;
  identifierFn?: (req: NextRequest) => string;
}

interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
  headers?: Record<string, string>;
}

/**
 * Redis-based rate limiting middleware for Next.js API routes
 * This uses Upstash Redis for persistence across serverless function invocations
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = { limit: 20, windowSizeInSeconds: 10 }
): Promise<RateLimitResult> {
  // If Redis URL or token is not configured, don't apply rate limiting
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis credentials not configured. Rate limiting disabled.');
    return { limited: false };
  }

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
    const data = await redis.get<{ count: number; resetTime: number }>(key);
    
    if (!data || data.resetTime < now) {
      // Initialize rate limit data for this client/endpoint
      await redis.set(
        key, 
        { count: 1, resetTime: now + windowSize },
        { ex: options.windowSizeInSeconds }
      );
      
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
    
    // Update the count in Redis
    await redis.set(
      key,
      { count: newCount, resetTime: data.resetTime },
      { ex: Math.ceil((data.resetTime - now) / 1000) }
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
