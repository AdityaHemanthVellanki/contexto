#!/usr/bin/env node

/**
 * Simple test to validate rate limiting works
 * Run: node test-rate-limiter.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test function to make requests
async function testRateLimiter(endpoint, numRequests = 12) {
  console.log(`Testing rate limiter for ${endpoint}...`);
  
  for (let i = 1; i <= numRequests; i++) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'x-user-id': 'test-user-123',
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Request ${i}: ${response.status} ${response.statusText}`);
      
      if (response.status === 429) {
        console.log('✅ Rate limiter working correctly - received 429 Too Many Requests');
        break;
      }
      
    } catch (error) {
      console.error(`Request ${i} failed:`, error.message);
    }
  }
}

// Run tests if server is running
console.log('Rate limiter test script');
console.log('Make sure your development server is running on port 3000');
console.log('Run: npm run dev');
console.log('');

// Test both endpoints
testRateLimiter('/api/uploads');
testRateLimiter('/api/exportMCP');
