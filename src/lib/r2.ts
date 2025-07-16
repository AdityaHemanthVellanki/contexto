import { S3Client } from "@aws-sdk/client-s3";

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
  console.error(`⚠️ Missing R2 environment variables: ${missingVars.join(', ')}`);
  console.error('File upload functionality will not work properly.');
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
  // Add proper retries and timeouts
  maxAttempts: 3,
});

// Export bucket name for use in other modules
export const R2_BUCKET = process.env.CF_R2_BUCKET_NAME || '';

// Debug info (remove sensitive data)
console.log(`R2 Configuration:`);
console.log(`- Endpoint: ${endpoint ? 'Configured' : 'Missing'}`);
console.log(`- Bucket: ${R2_BUCKET || 'Missing'}`);
console.log(`- Access Key ID: ${process.env.CF_R2_ACCESS_KEY_ID ? 'Configured' : 'Missing'}`);
console.log(`- Secret Access Key: ${process.env.CF_R2_SECRET_ACCESS_KEY ? 'Configured' : 'Missing'}`);

