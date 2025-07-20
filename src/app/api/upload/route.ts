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
    
    if (rateLimitResult.limited) {
      // Rate limit exceeded
      return NextResponse.json({ 
        message: 'Too many requests, please try again later' 
      }, { 
        status: 429,
        headers: rateLimitResult.headers as Record<string, string>
      });
    }
    
    // Apply Firebase authentication to ensure the user is signed in
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ message: 'Authentication failed' }, { status: 401 });
    }
    
    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found in token' }, { status: 400 });
    }
    
    // Debug R2 configuration
    console.log('R2 Configuration:');
    console.log(`- Endpoint: ${process.env.CF_R2_ENDPOINT ? 'Configured' : 'Not configured'}`);
    console.log(`- Bucket: ${R2_BUCKET || 'Not configured'}`);
    console.log(`- Access Key ID: ${process.env.CF_R2_ACCESS_KEY_ID ? 'Configured' : 'Not configured'}`);
    console.log(`- Secret Access Key: ${process.env.CF_R2_SECRET_ACCESS_KEY ? 'Configured' : 'Not configured'}`);
    
    // Check if we're receiving raw binary data with headers (for R2 upload)
    const contentType = request.headers.get('content-type') || '';
    
    // For debugging purposes
    console.log(`Upload request with Content-Type: "${contentType}"`);
    console.log(`Request method: ${request.method}`);
    
    // Handle binary upload
    if (contentType === 'application/octet-stream') {
      return await handleBinaryUpload(request, userId);
    } 
    
    // Handle JSON upload (client sending metadata with file data as base64 or URL)
    if (contentType.includes('application/json')) {
      try {
        const jsonData = await request.json();
        console.log('Received JSON upload request:', JSON.stringify(jsonData, null, 2));
        
        // TODO: Implement JSON-based upload processing
        // This could handle base64-encoded files or URLs to fetch
        
        return NextResponse.json({
          message: 'JSON upload processing not yet implemented',
          received: true,
          dataType: typeof jsonData
        }, { status: 501 }); // 501 Not Implemented
      } catch (error) {
        console.error('Error parsing JSON upload:', error);
        return NextResponse.json({
          message: 'Failed to parse JSON upload request'
        }, { status: 400 });
      }
    }
    
    // Check if content type is valid for formData parsing
    if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      console.error(`Invalid content type for formData: "${contentType}"`);
      return NextResponse.json({ 
        message: 'Invalid Content-Type. Expected multipart/form-data, application/x-www-form-urlencoded, application/json, or application/octet-stream', 
        received: contentType || '(empty)',
        hint: 'Make sure your upload request includes the proper Content-Type header'
      }, { status: 400 });
    }
    
    // Process multipart/form-data (standard form upload)
    try {
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

      // Check file size limit
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
        
        // Execute the upload
        const uploadCommand = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream' // Fallback content type
        });
        
        await r2.send(uploadCommand);
        console.log(`File successfully uploaded to R2: ${key}`);
        
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
        
        // Create response with the file details
        const response = NextResponse.json({
          fileId: uploadId,
          fileName: file.name,
          message: 'File uploaded successfully'
        }, { status: 200 });
        
        // Add rate limit headers to response if they exist
        if (rateLimitResult.headers && typeof rateLimitResult.headers === 'object') {
          const headers = rateLimitResult.headers as Record<string, string>;
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
        
        return response;
        
      } catch (uploadError) {
        console.error('R2 upload error details:', uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown R2 error';
        
        // Check for specific credential errors
        if (uploadError instanceof Error && uploadError.name === 'CredentialsProviderError') {
          return NextResponse.json({ 
            message: 'R2 authentication failed - Check R2 credentials', 
            errorType: 'R2CredentialsError' 
          }, { status: 401 });
        }
        
        // Handle other upload errors
        return NextResponse.json({
          message: `Failed to upload file: ${errorMessage}`,
          errorType: 'UploadError'
        }, { status: 500 });
      }
    } catch (formError) {
      console.error('Form data parsing error:', formError);
      const errorMessage = formError instanceof Error ? formError.message : 'Unknown form parsing error';
      return NextResponse.json({ 
        message: `Failed to process form data: ${errorMessage}` 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return NextResponse.json({ message: `Upload failed: ${message}` }, { status: 500 });
  }
}
