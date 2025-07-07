import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store for rate limiting
// In production, you would use Redis or another distributed cache
const ipRequestCounts: Record<string, { count: number, resetTime: number }> = {};

// Rate limit configuration
const RATE_LIMIT_MAX = 60; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

export async function rateLimit(request: NextRequest) {
  // Get IP address from headers
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const now = Date.now();
  
  // Initialize or get current record for this IP
  const record = ipRequestCounts[ip] || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  // If the window has expired, reset the counter
  if (record.resetTime < now) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    // Increment counter for this IP
    record.count++;
  }
  
  // Update the record
  ipRequestCounts[ip] = record;
  
  // Check if the request exceeds the rate limit
  if (record.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.floor(record.resetTime / 1000).toString(),
        'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString()
      }}
    );
  }
  
  // Request is within rate limits, allow it to proceed
  return null;
}
