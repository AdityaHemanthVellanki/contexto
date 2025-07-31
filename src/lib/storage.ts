/**
 * Storage utility functions for Cloudflare R2
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'contexto-files';
const URL_EXPIRATION = 3600; // 1 hour in seconds

/**
 * Generate a signed URL for uploading a file to R2
 * @param userId User ID
 * @param fileName Original file name
 * @param contentType MIME type of the file
 * @returns Object with upload URL and file metadata
 */
export async function getFileUploadUrl(
  userId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; fileId: string; key: string }> {
  const fileId = uuidv4();
  const key = `${userId}/${fileId}/${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRATION });
  
  return {
    uploadUrl,
    fileId,
    key,
  };
}

/**
 * Generate a signed URL for downloading a file from R2
 * @param key File key in the bucket
 * @returns Signed download URL
 */
export async function getFileDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn: URL_EXPIRATION });
}

/**
 * Get download URLs for multiple files
 * @param files Array of file metadata objects
 * @returns Promise resolving to array of file objects with download URLs
 */
export async function getFileDownloadUrls(
  files: Array<{ fileId: string; key: string; fileName: string; contentType: string }>
): Promise<Array<{ url: string; fileId: string; fileName: string; contentType: string }>> {
  const results = [];
  
  for (const file of files) {
    try {
      const url = await getFileDownloadUrl(file.key);
      results.push({
        url,
        fileId: file.fileId,
        fileName: file.fileName,
        contentType: file.contentType
      });
    } catch (error) {
      console.error(`Error getting download URL for ${file.fileName}:`, error);
      // Skip files that fail
    }
  }
  
  return results;
}
