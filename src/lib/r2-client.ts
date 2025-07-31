import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.CF_R2_BUCKET_NAME!;

/**
 * Generate a presigned URL for uploading files to R2
 */
export async function generateUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Generate a presigned URL for downloading files from R2
 */
export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Generate a unique file key for R2 storage
 */
export function generateFileKey(userId: string, fileId: string, originalName: string): string {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  return `users/${userId}/files/${fileId}/${timestamp}.${extension}`;
}

/**
 * Generate a unique export key for R2 storage
 */
export function generateExportKey(userId: string, exportId: string): string {
  return `users/${userId}/exports/${exportId}/mcp-pipeline.zip`;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/json',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  const allowedExtensions = ['json', 'txt', 'csv', 'md', 'pdf', 'docx', 'jpg', 'jpeg', 'png'];
  
  const maxSize = 50 * 1024 * 1024; // 50MB

  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  // Check file type
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    return { valid: false, error: 'File type not supported. Allowed types: JSON, TXT, CSV, MD, PDF, DOCX, JPG, JPEG, PNG' };
  }

  // Additional MIME type check
  if (!allowedTypes.includes(file.type) && file.type !== '') {
    return { valid: false, error: 'Invalid file type' };
  }

  return { valid: true };
}
