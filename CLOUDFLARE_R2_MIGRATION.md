# Cloudflare R2 Migration

This document outlines the migration of file storage from Firebase Storage to Cloudflare R2 in the Contexto application.

## Overview

The Contexto application previously used Firebase Storage for file uploads and storage. This migration moves all file storage to Cloudflare R2, while preserving all existing functionality and metadata in Firestore.

### Benefits

- **Cost Efficiency**: R2 offers better pricing with no egress fees compared to Firebase Storage
- **Performance**: Improved global distribution through Cloudflare's edge network
- **Scalability**: Better handling of large files and concurrent uploads
- **Security**: Maintained per-user file isolation and security rules

## Implementation Details

### Environment Setup

To use Cloudflare R2, the following environment variables must be set in `.env.local`:

```
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_R2_ACCESS_KEY_ID=your_r2_access_key_id
CF_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
CF_R2_BUCKET_NAME=contexto-uploads
CF_R2_ENDPOINT=https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com
```

### Major Components Updated

1. **R2 Client Configuration**
   - Created `src/lib/r2.ts` for AWS S3 client configuration for R2
   - Added validation for required environment variables
   - Configured S3 client with R2 credentials and endpoint

2. **API Routes**
   - Updated `/api/upload` to store files in R2 with user-isolated keys
   - Updated `/api/ingest` to fetch files from R2 instead of Firebase Storage
   - Maintained all existing metadata in Firestore for compatibility

3. **Front-end Components**
   - Updated `DataImportModal` to use binary file uploads optimized for R2
   - Added appropriate headers for file metadata
   - Improved error handling for R2 operations

4. **Next.js Configuration**
   - Increased body parser size limit to 50MB to support large file uploads

### File Structure and Security

- Files are stored in R2 with keys prefixed by user ID: `{userId}/uploads/{timestamp}_{filename}`
- Only metadata is stored in Firestore, with references to R2 file URLs
- Firestore security rules still enforce that users can only access their own uploads
- Backend API routes verify Firebase ID tokens before allowing R2 operations

## Migration Path

This migration was implemented with backward compatibility in mind. The existing Firestore metadata structure is preserved, with only the file storage backend changing.

### Testing

Before deploying to production, test the following:

1. File upload through the Data Import Modal
2. File ingestion and processing
3. Chat and query operations using ingested files
4. File export functionality
5. Error handling and edge cases

## Rollback Procedure

If issues are encountered, the application can be rolled back by:

1. Reverting code changes to use Firebase Storage
2. Re-uploading any new files to Firebase Storage
3. Updating Firestore metadata to point to Firebase Storage URLs

## Future Considerations

- Implement presigned URLs for more efficient direct-to-R2 uploads
- Add worker-based file processing for improved scalability
- Consider migrating other static assets to R2 or Cloudflare Images
