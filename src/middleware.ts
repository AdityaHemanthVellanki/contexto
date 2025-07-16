import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter-memory';

/**
 * Get the appropriate rate limiter based on environment
 * Uses Redis in production and in-memory in development
 */
async function getRateLimiter(req: NextRequest) {
  // Always use in-memory rate limiter now
  return rateLimit;
}

// Apply rate limiting to all API routes
export async function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      const limiter = await getRateLimiter(request);
      const result = await limiter(request);
      
      // Check if rate limited and a response is available
      if (result.limited && result.response) {
        return result.response;
      }
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue processing the request if rate limiting fails
    }
  }

  return NextResponse.next();
}

// Configure which paths the middleware is applied to
export const config = {
  matcher: '/api/:path*',
};
