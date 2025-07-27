import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client for Cloudflare R2
const s3 = new S3Client({
  endpoint: process.env.CF_R2_ENDPOINT!,
  region: "auto",
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true
});

/**
 * Generates a presigned URL for downloading a pipeline export
 * The URL is valid for 1 hour and provides temporary access to private R2 objects
 * @param userId The ID of the user requesting the export
 * @param fileId The ID of the file to export
 * @returns A promise that resolves to a presigned URL for downloading the file
 * @throws Error if the URL cannot be generated or if required environment variables are missing
 */
export async function getPipelineExportUrl(userId: string, fileId: string): Promise<string> {
  const bucket = process.env.CF_R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('CF_R2_BUCKET_NAME environment variable is not set');
  }

  const key = `users/${userId}/exports/${fileId}/mcp-pipeline.zip`;
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  
  try {
    // Generate a presigned URL that's valid for 1 hour
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
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
