import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

/**
 * Enhanced R2 client configuration with better error handling
 * and validation for Cloudflare R2 storage
 */

// Check required environment variables with detailed feedback
const missingVars = [];
if (!process.env.CF_R2_ACCESS_KEY_ID) missingVars.push('CF_R2_ACCESS_KEY_ID');
if (!process.env.CF_R2_SECRET_ACCESS_KEY) missingVars.push('CF_R2_SECRET_ACCESS_KEY');
if (!process.env.CF_R2_ENDPOINT) missingVars.push('CF_R2_ENDPOINT');
if (!process.env.CF_R2_BUCKET_NAME) missingVars.push('CF_R2_BUCKET_NAME');

if (missingVars.length > 0) {
  console.error(`⚠️ CRITICAL ERROR: Missing R2 environment variables: ${missingVars.join(', ')}`);
  console.error('File download and upload functionality will not work properly.');
  
  // Log to help with debugging
  console.error('Environment check:', {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
    hasAccessKey: !!process.env.CF_R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.CF_R2_SECRET_ACCESS_KEY,
    hasEndpoint: !!process.env.CF_R2_ENDPOINT,
    hasBucket: !!process.env.CF_R2_BUCKET_NAME
  });
}

// Ensure endpoint has correct format
let endpoint = process.env.CF_R2_ENDPOINT || '';

// Add protocol if missing
if (endpoint && !endpoint.startsWith('http')) {
  endpoint = `https://${endpoint}`;
}

// Remove trailing slashes for consistency
if (endpoint.endsWith('/')) {
  endpoint = endpoint.slice(0, -1);
}

// Initialize R2 client with S3 compatibility and improved error handling
export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || 'missing-key-id',
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || 'missing-secret-key',
  },
  // Add proper retries and timeouts with more generous limits
  maxAttempts: 3,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10000, // 10 seconds
    socketTimeout: 30000,    // 30 seconds
  }),
  // Force path style for better compatibility with Cloudflare R2
  forcePathStyle: true,
});

// Export bucket name for use in other modules
export const R2_BUCKET = process.env.CF_R2_BUCKET_NAME || '';

// Debug info (remove sensitive data)
console.log(`R2 Configuration:`);
console.log(`- Endpoint: ${endpoint ? 'Configured' : 'Missing'}`);
console.log(`- Bucket: ${R2_BUCKET || 'Missing'}`);
console.log(`- Access Key ID: ${process.env.CF_R2_ACCESS_KEY_ID ? 'Configured' : 'Missing'}`);
console.log(`- Secret Access Key: ${process.env.CF_R2_SECRET_ACCESS_KEY ? 'Configured' : 'Missing'}`);

