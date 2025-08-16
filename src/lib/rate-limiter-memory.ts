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
  identifier: string,
  options: { limit: number; windowSizeInSeconds: number } = { limit: 60, windowSizeInSeconds: 60 }
): Promise<RateLimitResult> {
  // Validate and coerce values to safe defaults
  const rawLimit = options?.limit;
  const rawWindow = options?.windowSizeInSeconds;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 60;
  const windowSizeInSeconds = Number.isFinite(rawWindow) && rawWindow > 0 ? rawWindow : 60;
  const now = Date.now();
  const windowStart = now - (windowSizeInSeconds * 1000);
  
  // Get existing data for this identifier
  const data = rateLimitStore.get(identifier) || { count: 0, resetTime: now + (windowSizeInSeconds * 1000) };
  
  // Reset if window has expired
  if (now > data.resetTime) {
    data.count = 0;
    data.resetTime = now + (windowSizeInSeconds * 1000);
  }
  
  // Increment count
  data.count++;
  rateLimitStore.set(identifier, data);
  
  const limited = data.count > limit;
  
  return {
    limited,
    response: limited ? NextResponse.json({ error: 'Too many requests' }, { status: 429 }) : undefined,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - data.count)),
      'X-RateLimit-Reset': String(Math.floor(data.resetTime / 1000)),
    },
  };
}
