import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/middleware/rateLimit';

/**
 * Get the appropriate rate limiter based on environment
 * Uses Redis in production and in-memory in development
 */
async function getRateLimiter(req: NextRequest) {
  // Check if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    try {
      // Dynamically import Redis rate limiter to avoid errors in environments without Redis
      const { redisRateLimit } = await import('@/middleware/redisRateLimit');
      return redisRateLimit;
    } catch (error) {
      console.warn('Failed to load Redis rate limiter, falling back to in-memory:', error);
      return rateLimit;
    }
  }
  
  // Use in-memory rate limiter for development
  return rateLimit;
}

// Apply rate limiting to all API routes
export async function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      const limiter = await getRateLimiter(request);
      const response = await limiter(request);
      if (response) return response;
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
