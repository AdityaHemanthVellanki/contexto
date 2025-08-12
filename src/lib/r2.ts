import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand, GetObjectCommand, S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import * as fs from 'fs';
import { Buffer } from 'buffer';

/**
 * Enhanced R2 client configuration with better error handling
 * and validation for Cloudflare R2 storage
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

// Log environment status for debugging
// Log environment status in non-production environments
if (process.env.NODE_ENV !== 'production') {
  console.log('R2 Environment Status:', {
    NODE_ENV: process.env.NODE_ENV,
    HEROKU_REGION: process.env.HEROKU_REGION || 'not set',
    hasAccessKey: !!process.env.CF_R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.CF_R2_SECRET_ACCESS_KEY,
    hasEndpoint: !!process.env.CF_R2_ENDPOINT,
    hasBucket: !!process.env.CF_R2_BUCKET_NAME
  });
}

// Ensure endpoint has correct format
let endpoint = process.env.CF_R2_ENDPOINT;

// Add protocol if missing
if (endpoint && !endpoint.startsWith('http')) {
  endpoint = `https://${endpoint}`;
}

// Remove trailing slashes for consistency
if (endpoint.endsWith('/')) {
  endpoint = endpoint.slice(0, -1);
}

// Initialize the R2 client
let r2Client: S3Client | null = null;

// Function to get the R2 client
export function getR2Client(): S3Client | null {
  // In test environment, we don't initialize the R2 client
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const accessKeyId: string = process.env.CF_R2_ACCESS_KEY_ID as string;
  const secretAccessKey: string = process.env.CF_R2_SECRET_ACCESS_KEY as string;
  const endpoint: string = process.env.CF_R2_ENDPOINT as string;
  const region: string = process.env.HEROKU_REGION || 'auto';

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing R2 credentials');
    }
    console.warn('R2 credentials are missing. R2 client will not be initialized.');
    return null;
  }

  const config: S3ClientConfig = {
    region: 'auto',
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000,
    }),
  };

  r2Client = new S3Client(config);
  return r2Client;
}

/**
 * Generates a download URL for a pipeline ZIP file in Cloudflare R2
 * @param userId The ID of the user who owns the pipeline
 * @param fileId The ID of the file to download
 * @returns A fully qualified HTTPS URL to download the pipeline ZIP
 * @throws Error if required environment variables are not properly configured
 */
/**
 * Generates a download URL for a pipeline ZIP file in Cloudflare R2
 * @param userId The ID of the user who owns the pipeline
 * @param fileId The ID of the file to download
 * @returns A fully qualified HTTPS URL to download the pipeline ZIP
 * @throws Error if required environment variables are not properly configured
 */
export function getPipelineDownloadUrl(userId: string, fileId: string): string {
  // Use process.env for environment variables
  const endpoint = process.env.CF_R2_ENDPOINT;
  const bucketName = process.env.CF_R2_BUCKET_NAME;
  
  // Validate environment variables
  if (!endpoint) {
    throw new Error('Missing required CF_R2_ENDPOINT environment variable');
  }
  
  if (!bucketName) {
    throw new Error('Missing required CF_R2_BUCKET_NAME environment variable');
  }
  
  // Ensure endpoint has protocol
  const base = endpoint.startsWith('http') 
    ? endpoint.replace(/\/+$/, '') 
    : `https://${endpoint.replace(/\/+$/, '')}`;
  
  // Clean up bucket name
  const bucket = bucketName.replace(/^\/+|\/+$/g, '');
  
  // Construct the R2 object key (path in the bucket)
  const objectKey = `users/${encodeURIComponent(userId)}/exports/${encodeURIComponent(fileId)}/mcp-pipeline.zip`;
  
  // Build the full URL with bucket in the path
  const downloadUrl = `${base}/${bucket}/${objectKey}`;
  
  // Validate the final URL
  if (!/^https:\/\//.test(downloadUrl)) {
    throw new Error(`Invalid download URL (must start with https://): ${downloadUrl}`);
  }
  
  // Log the generated URL (without sensitive parts)
  if (process.env.NODE_ENV !== 'production') {
    const safeUrl = new URL(downloadUrl);
    console.log('exportService: Generated download URL:', {
      hostname: safeUrl.hostname,
      bucket,
      objectKey
    });
  }
  
  return downloadUrl;
}

/**
 * Uploads a file to Cloudflare R2 storage
 * @param filePath Path to the file to upload
 * @param key The key/path to store the file under in the bucket
 * @param mimeType The MIME type of the file
 * @returns The result of the upload operation
 * @throws Error if the upload fails or if the client is not initialized
 */
export async function uploadToR2(filePath: string, key: string, mimeType: string) {
  const client = getR2Client();
  if (!client) {
    throw new Error('R2 client not initialized');
  }
  const bucketName = process.env.CF_R2_BUCKET_NAME;

  const fileContent = fs.readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: mimeType,
  });

  await client.send(command);

  return getR2PublicUrl(key);
}

/**
 * Generates a public URL for an R2 object
 * @param key The object key in the R2 bucket
 * @returns A fully qualified public URL for the object
 * @throws Error if required environment variables are missing
 */
export function getR2PublicUrl(key: string): string {
  if (!key) {
    throw new Error('Object key is required');
  }

  const publicUrl = process.env.CF_R2_PUBLIC_URL;
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  
  // Validate required environment variables
  if (!publicUrl) {
    throw new Error('CF_R2_PUBLIC_URL is not set');
  }
  
  if (!accountId) {
    throw new Error('Either CF_R2_PUBLIC_URL or CF_R2_ACCOUNT_ID environment variable must be set');
  }
  
  // If public URL is explicitly set, use it
  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
  }
  
  // Fall back to default Cloudflare R2 public URL format
  return `https://${accountId}.r2.dev/${key.replace(/^\/+/, '')}`;
}

// Export bucket name for use in other modules
export const R2_BUCKET = process.env.CF_R2_BUCKET_NAME || 'contexto-files';

// Initialize R2 client with S3 compatibility and improved error handling
export const r2 = getR2Client() || new S3Client({
  region: 'auto',
  endpoint: endpoint || `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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

// Export the S3 commands for easier imports
export { GetObjectCommand, PutObjectCommand };

// Debug info (remove sensitive data)
console.log('CF_R2_ACCESS_KEY_ID:', process.env.CF_R2_ACCESS_KEY_ID);
console.log(`R2 Configuration:`);
console.log(`- Endpoint: ${endpoint ? 'Configured' : 'Missing'}`);
console.log(`- Bucket: ${R2_BUCKET || 'Missing'}`);
console.log(`- Access Key ID: ${process.env.CF_R2_ACCESS_KEY_ID ? 'Configured' : 'Missing'}`);
console.log(`- Secret Access Key: ${process.env.CF_R2_SECRET_ACCESS_KEY ? 'Configured' : 'Missing'}`);
