import { NextRequest, NextResponse } from 'next/server';

// Define a minimal interface for the Redis client methods we use
interface RedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * Redis-backed rate limiter for production environments
 * Uses Upstash Redis for distributed rate limiting across multiple instances
 */

// Configuration options for rate limiting
export interface RedisRateLimitConfig {
  // Maximum number of requests per window
  limit: number;
  // Time window in seconds
  windowInSeconds: number;
  // Custom key generator function
  keyGenerator?: (req: NextRequest) => Promise<string> | string;
}

/**
 * Default configuration for rate limiting
 */
const DEFAULT_CONFIG: RedisRateLimitConfig = {
  limit: 50,
  windowInSeconds: 60,
};

/**
 * Default key generator - uses IP address as key
 */
function defaultKeyGenerator(req: NextRequest): string {
  // Get IP from X-Forwarded-For header or other headers
  const xff = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  // Use the first IP from X-Forwarded-For, or X-Real-IP, or default to localhost
  const ip = xff ? xff.split(',')[0].trim() : realIp || '127.0.0.1';
  return `rate-limit:${ip}`;
}

/**
 * Initialize Redis client
 */
async function getRedisClient(): Promise<RedisClient | null> {
  // Check if Redis URL is configured
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    console.warn('UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not configured, falling back to in-memory rate limiting');
    return null;
  }

  try {
    // Dynamically import Redis to avoid issues in environments without Redis
    const { Redis } = await import('@upstash/redis');
    
    // Create Redis client
    return new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    });
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Redis-based rate limiter middleware
 * Falls back to in-memory rate limiting if Redis is not configured
 */
export async function redisRateLimit(
  req: NextRequest,
  config: Partial<RedisRateLimitConfig> = {}
): Promise<NextResponse | null> {
  // Merge with default config
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Generate key for this request
  const keyGenerator = finalConfig.keyGenerator || defaultKeyGenerator;
  const key = await keyGenerator(req);

  try {
    // Try to get Redis client - if not available, fall back to in-memory rate limiting
    const redis = await getRedisClient();
    if (!redis) {
      // Import in-memory rate limiter dynamically to avoid circular dependencies
      const { rateLimit } = await import('./rateLimit');
      // Call rateLimit with just the request parameter as it handles its own config internally
      return rateLimit(req);
    }

    // Increment counter for this key
    const requests = await redis.incr(key);
    
    // Set expiration on first request
    if (requests === 1) {
      // Set expiration time (TTL) for the key
      // We're using a wrapper function that handles the type properly
      await redis.expire(key, finalConfig.windowInSeconds);
    }
    
    // Get remaining time in window
    const ttl = await redis.ttl(key);
    
    // Set rate limit headers
    const headers = {
      'X-RateLimit-Limit': finalConfig.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, finalConfig.limit - requests).toString(),
      'X-RateLimit-Reset': (Date.now() + ttl * 1000).toString(),
    };
    
    // If limit is exceeded, return 429 Too Many Requests
    if (requests > finalConfig.limit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': ttl.toString(),
          },
        }
      );
    }
    
    // Otherwise, continue processing the request
    return null;
  } catch (error) {
    // If Redis fails, log error and allow the request through
    console.error('Redis rate limiting error:', error);
    return null;
  }
}
