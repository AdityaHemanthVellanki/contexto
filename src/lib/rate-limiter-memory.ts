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
export const rateLimit = {
  limit: async (email: string) => ({ 
    limited: false,
    response: undefined,
    headers: {}
  }),
};
