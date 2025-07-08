import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter';

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
    if (rateLimitResult.limited && rateLimitResult.response) {
      return rateLimitResult.response;
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

    // Process multipart/form-data
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
    
    // Read file content as appropriate format
    const arrayBuffer = await file.arrayBuffer();
    let fileContent = '';
    
    // Process content based on file type
    if (file.type === 'application/pdf') {
      // Convert binary files to Base64 string
      const buffer = Buffer.from(arrayBuffer);
      fileContent = buffer.toString('base64');
    } else {
      // For text files (text/plain, text/csv, application/json, text/markdown)
      // Convert ArrayBuffer to UTF-8 string
      const decoder = new TextDecoder('utf-8');
      fileContent = decoder.decode(arrayBuffer);
    }
    
    // Store file content and metadata directly in Firestore
    const uploadRef = db.collection('uploads').doc(uploadId);
    await uploadRef.set({
      userId,
      fileId: uploadId,
      fileName: file.name,
      fileType: file.type,
      fileContent, // Store content directly in Firestore
      fileSize: file.size,
      uploadedAt: FieldValue.serverTimestamp(),
      status: 'uploaded',
    });

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
