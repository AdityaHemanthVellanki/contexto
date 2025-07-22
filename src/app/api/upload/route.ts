import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// Import Firebase Admin SDK and Firestore admin
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestoreAdmin } from '@/lib/firestore-admin';

/**
 * Handle binary file upload directly from raw request body
 * This is the recommended approach for the new R2 storage implementation
 * Also works as a fallback for various types of uploads
 */
async function handleBinaryUpload(request: NextRequest, userId: string): Promise<NextResponse> {
  // Get file metadata from headers
  let filename = request.headers.get('x-filename');
  let mimetype = request.headers.get('x-mimetype') || request.headers.get('content-type');
  
  // Generate default values if headers are missing
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filename = `upload-${timestamp}.txt`;
    console.log(`No filename provided, using default: ${filename}`);
  }
  
  // Detect file type from filename extension if mimetype is missing or generic
  if (!mimetype || mimetype === 'application/octet-stream') {
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    console.log(`Detecting mimetype from extension: ${fileExtension}`);
    
    // Map common file extensions to MIME types
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'json': 'application/json',
      'html': 'text/html',
      'xml': 'application/xml',
    };
    
    if (fileExtension && mimeMap[fileExtension]) {
      mimetype = mimeMap[fileExtension];
      console.log(`Detected mimetype from extension: ${mimetype}`);
    } else {
      mimetype = 'application/octet-stream';
      console.log(`Could not detect mimetype, using default: ${mimetype}`);
    }
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
    
    // Store metadata in Firestore using Firebase Admin SDK directly
    const db = await getFirestoreAdmin();
    const uploadRef = db.collection('uploads').doc(uploadId);
    
    // Create complete document with all required fields including userId
    await uploadRef.set({
      userId,  // This is crucial for security rules - matches the authenticated user
      fileId: uploadId,
      fileName: filename,
      fileType: mimetype,
      fileSize: buffer.byteLength,
      fileUrl,
      r2Key: key,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'uploaded',
    }, { merge: false }); // Ensure complete document replacement
    
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

// Use Firebase Admin FieldValue directly - no need for an instance
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
    console.log(`Headers: ${JSON.stringify([...request.headers.entries()])}`); // Log all headers
    
    // Handle binary uploads - support a wide range of content types
    const binaryContentTypes = [
      'application/octet-stream',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/',
      'audio/',
      'video/',
      'application/zip',
      'application/x-rar-compressed',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    
    const isBinaryUpload = binaryContentTypes.some(type => contentType.includes(type));
    
    // If it's a binary file or no content type is specified, handle as binary upload
    if (isBinaryUpload || !contentType) {
      console.log(`Handling as binary upload with content type: ${contentType || 'unspecified'}`);
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
    
    // Handle empty Content-Type (browser might not always set it properly)
    if (!contentType) {
      console.log('Empty Content-Type detected, processing as binary upload');
      // For empty Content-Type, process as binary upload
      return await handleBinaryUpload(request, userId);
    }
    // Process non-multipart and non-form-urlencoded content types appropriately
    else if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      console.log(`Content-Type is not form data: "${contentType}"`);
      
      // If it's a binary type, handle as binary upload
      if (contentType.includes('application/') || 
          contentType.includes('text/') ||
          contentType.includes('image/') ||
          contentType.includes('video/')) {
        console.log('Processing as binary upload');
        return await handleBinaryUpload(request, userId);
      }
      
      // For unrecognized types, handle as binary upload as a fallback
      console.log('Unrecognized Content-Type, falling back to binary upload');
      return await handleBinaryUpload(request, userId);
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
        const db = await getFirestoreAdmin();
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
