import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Handle binary file upload directly from raw request body
 * This is the recommended approach for the new R2 storage implementation
 */
async function handleBinaryUpload(request: NextRequest, userId: string): Promise<NextResponse> {
  // Get file metadata from headers
  const filename = request.headers.get('x-filename');
  const mimetype = request.headers.get('x-mimetype');
  
  if (!filename || !mimetype) {
    return NextResponse.json({ 
      message: 'Missing required headers: x-filename and x-mimetype' 
    }, { status: 400 });
  }
  
  // Create a unique file identifier
  const timestamp = Date.now();
  const uploadId = `${userId}_${timestamp}`;
  
  try {
    // Read the binary data from the request body
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate file size
    const maxSize = 52428800; // 50MB
    if (buffer.byteLength > maxSize) {
      return NextResponse.json({ 
        message: 'File too large. Maximum size is 50MB' 
      }, { status: 400 });
    }
    
    // Create the R2 object key with user isolation
    const key = `${userId}/uploads/${timestamp}_${filename}`;
    
    // Upload to R2 with enhanced error handling
    try {
      // Log upload attempt (for debugging)
      console.log(`Attempting R2 upload with key: ${key}`);
      console.log(`Content type: ${mimetype}, Size: ${buffer.byteLength} bytes`);
      
      // Validate R2 bucket name is not empty
      if (!R2_BUCKET) {
        throw new Error('R2_BUCKET environment variable is not properly configured');
      }
      
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimetype || 'application/octet-stream' // Provide fallback content type
        })
      );
      
      console.log(`Binary file successfully uploaded to R2: ${key}`);
    } catch (uploadError) {
      console.error('R2 upload error details:', uploadError);
      return NextResponse.json({ 
        message: `R2 upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`, 
        errorType: 'R2UploadError'
      }, { status: 500 });
    }
    
    // Generate R2 file URL
    const fileUrl = process.env.CF_R2_ENDPOINT 
      ? `${process.env.CF_R2_ENDPOINT}/${R2_BUCKET}/${encodeURIComponent(key)}`
      : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${encodeURIComponent(key)}`;
    
    // Store metadata in Firestore
    const uploadRef = getFirestore().collection('uploads').doc(uploadId);
    await uploadRef.set({
      userId,
      fileId: uploadId,
      fileName: filename,
      fileType: mimetype,
      fileSize: buffer.byteLength,
      fileUrl,
      r2Key: key,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'uploaded',
    });
    
    return NextResponse.json({
      fileId: uploadId,
      fileName: filename,
      fileUrl,
      message: 'File uploaded successfully to R2'
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('Binary upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ message: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}

// Initialize Firebase Admin services
const db = getFirestore();
const FieldValue = admin.firestore.FieldValue;

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting - 5 requests per 10 seconds per user/IP
    // More restrictive for uploads as they're resource-intensive
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      windowSizeInSeconds: 10
    });
    
    // Return rate limit response if limit exceeded
    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded', error: 'rate_limited' },
        { status: 429 }
      );
    }
    
    // Authenticate request
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return auth.response;
    }
    
    const userId = auth.userId;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    // Check if we're receiving raw binary data with headers (for R2 upload)
    const contentType = request.headers.get('content-type');
    
    if (contentType === 'application/octet-stream') {
      return await handleBinaryUpload(request, userId);
    } 
    
    // Process multipart/form-data (legacy form upload)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ message: 'Bad request: No file provided' }, { status: 400 });
    }

    // Validate file
    const validTypes = ['text/plain', 'text/csv', 'application/json', 'application/pdf', 'text/markdown'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        message: 'Invalid file type. Supported types: TXT, CSV, JSON, PDF, MD' 
      }, { status: 400 });
    }

    const maxSize = 52428800; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        message: 'File too large. Maximum size is 50MB' 
      }, { status: 400 });
    }

    // Create a unique fileId
    const timestamp = Date.now();
    const uploadId = `${userId}_${timestamp}`;
    
    // Read file content as array buffer for upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create a unique key for R2 storage with user isolation
    const key = `${userId}/uploads/${timestamp}_${file.name}`;
    
    // Upload file to R2 with extensive error handling and debugging
    try {
      // Log detailed information about the upload attempt
      console.log('Form upload attempt:', { 
        fileName: file.name,
        fileType: file.type, 
        fileSize: file.size, 
        bucketName: R2_BUCKET,
        key
      });
      
      // Validate R2 configuration
      if (!R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured');
      }
      
      // Check endpoint configuration
      const endpoint = process.env.CF_R2_ENDPOINT;
      console.log(`Using R2 endpoint: ${endpoint || 'Default endpoint'}`); 
      
      // Execute the upload with better error handling
      try {
        const uploadCommand = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream' // Fallback content type
        });
        
        await r2.send(uploadCommand);
        console.log(`File successfully uploaded to R2: ${key}`);
      } catch (uploadError) {
        console.error('R2 client error details:', uploadError);
        if (uploadError instanceof Error && uploadError.name === 'CredentialsProviderError') {
          return NextResponse.json({ 
            message: 'R2 authentication failed - Check R2 credentials', 
            errorType: 'R2CredentialsError' 
          }, { status: 401 });
        }
        throw uploadError; // Re-throw to be caught by outer catch
      }
      
      // Generate R2 file URL with more robust handling
      let fileUrl;
      if (process.env.CF_R2_ENDPOINT) {
        const baseEndpoint = process.env.CF_R2_ENDPOINT.endsWith('/') ? 
          process.env.CF_R2_ENDPOINT.slice(0, -1) : process.env.CF_R2_ENDPOINT;
        fileUrl = `${baseEndpoint}/${R2_BUCKET}/${encodeURIComponent(key)}`;
      } else {
        fileUrl = `https://${R2_BUCKET}.r2.cloudflarestorage.com/${encodeURIComponent(key)}`;
      }
      
      console.log(`Generated file URL: ${fileUrl}`);
      
      // Store only metadata in Firestore (not the file content)
      const uploadRef = db.collection('uploads').doc(uploadId);
      await uploadRef.set({
        userId,
        fileId: uploadId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl, 
        r2Key: key,
        uploadedAt: FieldValue.serverTimestamp(),
        status: 'uploaded',
      });
    } catch (error: unknown) {
      console.error('Complete R2 upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown R2 error';
      
      // Return a JSON error response instead of throwing
      return NextResponse.json({
        message: `Failed to upload file: ${errorMessage}`,
        errorType: 'UploadError'
      }, { status: 500 });
    }

    // Create response with the file details
    const response = NextResponse.json({
      fileId: uploadId,
      fileName: file.name,
      message: 'File uploaded successfully'
    }, { status: 200 });
    
    // Add rate limit headers to response
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }
    
    return response;

  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ message: `Upload failed: ${message}` }, { status: 500 });
  }
}
