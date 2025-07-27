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
    HEROKU_REGION: process.env.HEROKU_REGION || 'not set',
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

/**
 * Generates a download URL for a pipeline ZIP file in Cloudflare R2
 * @param userId The ID of the user who owns the pipeline
 * @param fileId The ID of the file to download
 * @returns A fully qualified HTTPS URL to download the pipeline ZIP
 * @throws Error if required environment variables are not properly configured
 */
export function getPipelineDownloadUrl(userId: string, fileId: string): string {
  const CF_R2_ENDPOINT = process.env.CF_R2_ENDPOINT;
  const CF_R2_BUCKET_NAME = process.env.CF_R2_BUCKET_NAME;
  
  // Validate environment variables
  if (!CF_R2_ENDPOINT?.startsWith('https://')) {
    throw new Error('Missing or invalid CF_R2_ENDPOINT; must be full https:// URL');
  }
  
  if (!CF_R2_BUCKET_NAME) {
    throw new Error('Missing required CF_R2_BUCKET_NAME environment variable');
  }
  
  // Remove any trailing slashes from the endpoint and bucket name
  const base = CF_R2_ENDPOINT.replace(/\/+$/, '');
  const bucket = CF_R2_BUCKET_NAME.replace(/^\/+|\/+$/g, '');
  
  // Construct the R2 object key (path in the bucket)
  const objectKey = `users/${encodeURIComponent(userId)}/exports/${encodeURIComponent(fileId)}/mcp-pipeline.zip`;
  
  // Build the full URL with bucket in the path
  const downloadUrl = `${base}/${bucket}/${objectKey}`;
  
  // Validate the final URL
  if (!/^https:\/\//.test(downloadUrl)) {
    throw new Error(`Invalid downloadUrl (must start with https://): ${downloadUrl}`);
  }
  
  // Log the generated URL (without sensitive parts)
  const safeUrl = new URL(downloadUrl);
  console.log('exportService: Generated download URL:', {
    hostname: safeUrl.hostname,
    bucket,
    objectKey,
    fullUrl: downloadUrl // Be careful with logging full URLs in production
  });
  
  return downloadUrl;
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

