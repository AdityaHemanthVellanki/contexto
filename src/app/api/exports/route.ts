import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize Firebase Admin services
const db = getFirestore();
const admin = getFirebaseAdmin();
const FieldValue = admin.firestore.FieldValue;

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting - 3 requests per 30 seconds per user/IP (stricter for POST)
    const rateLimitResult = await rateLimit(request, {
      limit: 3,
      windowSizeInSeconds: 30
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

    // Parse the request body
    const body = await request.json();
    const { pipelineId, exportContent, fileName, contentType = 'application/json' } = body;
    
    if (!pipelineId || !exportContent) {
      return NextResponse.json({ message: 'Missing required fields: pipelineId and exportContent' }, { status: 400 });
    }
    
    // Create a unique identifier for the export
    const timestamp = Date.now();
    const exportId = `${userId}_${timestamp}`;
    const safeFileName = fileName || `export_${timestamp}.json`;
    
    // For binary data, we'll decode the base64 content
    let fileBuffer;
    if (typeof exportContent === 'string' && exportContent.startsWith('data:')) {
      // Handle data URL format
      const matches = exportContent.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const dataContentType = matches[1];
        const base64Data = matches[2];
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else {
        return NextResponse.json({ message: 'Invalid data URL format' }, { status: 400 });
      }
    } else if (typeof exportContent === 'string') {
      // Assume it's already base64 encoded or regular string
      try {
        // Try to decode as base64 first
        fileBuffer = Buffer.from(exportContent, 'base64');
      } catch (e) {
        // If that fails, treat as UTF-8 string
        fileBuffer = Buffer.from(exportContent, 'utf-8');
      }
    } else {
      // For object data, stringify it
      fileBuffer = Buffer.from(JSON.stringify(exportContent), 'utf-8');
    }
    
    // Upload the content to R2
    const r2Key = `${userId}/exports/${timestamp}_${safeFileName}`;
    
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: fileBuffer,
          ContentType: contentType
        })
      );
      
      console.log(`Export successfully uploaded to R2: ${r2Key}`);
    } catch (r2Error) {
      console.error('Error uploading export to R2:', r2Error);
      return NextResponse.json({ 
        message: `Failed to upload export to storage: ${r2Error instanceof Error ? r2Error.message : 'Unknown error'}` 
      }, { status: 500 });
    }
    
    // Create metadata entry in Firestore
    const exportRef = db.collection('exports').doc(exportId);
    await exportRef.set({
      userId,
      exportId,
      pipelineId,
      fileName: safeFileName,
      r2Key, // Store R2 key instead of content directly
      contentType,
      fileSize: fileBuffer.byteLength,
      exportedAt: FieldValue.serverTimestamp()
    });
    
    // Success response
    const response = NextResponse.json({
      exportId,
      fileName: safeFileName,
      message: 'Export created successfully'
    }, { status: 201 });
    
    // Add rate limit headers to response
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error creating export:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    // Check if it's a storage error
    if (message.includes('storage') || message.includes('R2')) {
      return NextResponse.json({ message: `Storage error: ${message}` }, { status: 502 });
    }
    
    return NextResponse.json({ message: `Failed to create export: ${message}` }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - 10 requests per 5 seconds per user/IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      windowSizeInSeconds: 5
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

    // Query exports collection for user's exports
    const exportsRef = db.collection('exports');
    const query = exportsRef.where('userId', '==', userId).orderBy('exportedAt', 'desc');
    const snapshot = await query.get();

    const exports = snapshot.docs.map(doc => {
      const data = doc.data();
      // Safely handle the timestamp conversion
      let exportedAt;
      try {
        exportedAt = data.exportedAt && typeof data.exportedAt.toDate === 'function' 
          ? data.exportedAt.toDate() 
          : new Date();
      } catch (e) {
        console.warn('Error converting timestamp for export', doc.id, e);
        exportedAt = new Date();
      }
      
      return {
        exportId: doc.id,
        pipelineId: data.pipelineId || '',
        fileName: data.fileName || 'MCP Export',
        contentType: data.contentType || 'application/json',
        fileSize: data.fileSize || 0,
        exportedAt: exportedAt
      };
    });
    
    console.log(`Retrieved ${exports.length} exports for user ${userId}`);

    const response = NextResponse.json({ exports });
    
    // Add rate limit headers to response
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }
    
    return response;
  } catch (error) {
    console.error('Error fetching exports:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    return NextResponse.json({ message: `Failed to fetch exports: ${message}` }, { status: 500 });
  }
}
