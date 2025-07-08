import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store for rate limiting
// In production, this should be replaced with Redis or another distributed cache
const rateLimitStore: Record<string, { count: number, resetTime: number }> = {};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 60000); // Clean up every minute

interface RateLimitOptions {
  // Maximum number of requests allowed in the time window
  limit: number;
  // Time window in seconds
  windowSizeInSeconds: number;
  // Optional identifier function to customize how to identify clients
  identifierFn?: (req: NextRequest) => string;
}

interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
  headers?: Record<string, string>;
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = { limit: 20, windowSizeInSeconds: 10 }
): Promise<RateLimitResult> {
  // Get client identifier (forwarded IP or headers by default)
  const identifier = options.identifierFn 
    ? options.identifierFn(req) 
    : (req.headers.get('x-forwarded-for') || 
       req.headers.get('x-real-ip') || 
       'unknown-ip');
  
  // Add endpoint to make rate limiting specific to each API endpoint
  const endpoint = new URL(req.url).pathname;
  const key = `${identifier}:${endpoint}`;
  
  const now = Date.now();
  const windowSize = options.windowSizeInSeconds * 1000;
  
  // Initialize or get the rate limit data for this client
  if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + windowSize
    };
    return { limited: false };
  }
  
  // Increment the request count
  rateLimitStore[key].count += 1;
  
  // Check if the client has exceeded their rate limit
  if (rateLimitStore[key].count > options.limit) {
    // Calculate remaining time until rate limit reset
    const retryAfter = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);
    
    // Return a 429 Too Many Requests response
    const response = NextResponse.json(
      { message: 'Too Many Requests', retryAfter },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': options.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
        }
      }
    );
    
    return { limited: true, response };
  }
  
  // Add rate limit headers to successful responses
  const remaining = Math.max(0, options.limit - rateLimitStore[key].count);
  
  return { 
    limited: false,
    response: undefined,
    headers: {
      'X-RateLimit-Limit': options.limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
    }
  };
}
