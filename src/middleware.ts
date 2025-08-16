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
      // Build a stable identifier: client IP + path
      const ipHeader = request.headers.get('x-forwarded-for');
      const ip =
        (ipHeader ? ipHeader.split(',')[0]?.trim() : undefined) ||
        // @ts-ignore - NextRequest may provide ip in some runtimes
        (request as any).ip ||
        'unknown';
      const identifier = `${ip}:${request.nextUrl.pathname}`;
      const result = await limiter(identifier, { limit: 60, windowSizeInSeconds: 60 });
      // If limited, return 429 with rate limit headers
      if (result.limited && result.response) {
        if (result.headers) {
          for (const [key, value] of Object.entries(result.headers)) {
            result.response.headers.set(key, value);
          }
        }
        return result.response;
      }
      // Otherwise continue and attach rate limit headers
      const nextRes = NextResponse.next();
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          nextRes.headers.set(key, value);
        }
      }
      return nextRes;
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
