import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { getServerEnv } from '@/lib/env';

// Get environment variables
const env = getServerEnv();

// Initialize S3 client for Cloudflare R2
if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_PUBLIC_URL || !env.CF_R2_BUCKET_NAME) {
  throw new Error('Missing required R2 configuration in environment variables');
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: env.R2_PUBLIC_URL,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = env.CF_R2_BUCKET_NAME;

/**
 * Generates a presigned URL for downloading a pipeline export
 * The URL is valid for 1 hour and provides temporary access to private R2 objects
 * @param userId The ID of the user requesting the export
 * @param fileId The ID of the file to export
 * @returns A promise that resolves to a presigned URL for downloading the file
 * @throws Error if the URL cannot be generated or if required environment variables are missing
 */
export async function getPipelineExportUrl(userId: string, fileId: string): Promise<string> {
  const bucket = BUCKET_NAME;
  if (!bucket) {
    throw new Error('CF_R2_BUCKET_NAME environment variable is not set');
  }

  const key = `users/${userId}/exports/${fileId}/mcp-pipeline.zip`;
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  
  try {
    // Generate a presigned URL that's valid for 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Log the full URL in development, minimal info in production
    if (process.env.NODE_ENV === 'production') {
      const urlObj = new URL(url);
      console.log('exportService: Generated presigned URL', {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        hasQueryParams: !!urlObj.search,
        expiresIn: '1h'
      });
    } else {
      console.log('exportService: Generated presigned URL →', url);
    }
    
    return url;
  } catch (error) {
    console.error('exportService: Error generating presigned URL:', error);
    throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
