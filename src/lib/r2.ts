import { S3Client } from "@aws-sdk/client-s3";

// Verify environment variables are present
if (!process.env.CF_R2_ACCESS_KEY_ID || 
    !process.env.CF_R2_SECRET_ACCESS_KEY ||
    !process.env.CF_R2_ENDPOINT || 
    !process.env.CF_R2_BUCKET_NAME) {
  throw new Error("Missing required R2 environment variables");
}

// Initialize R2 client with S3 compatibility
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.CF_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
});

// Export bucket name for use in other modules
export const R2_BUCKET = process.env.CF_R2_BUCKET_NAME;
