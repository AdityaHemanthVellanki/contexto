import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { getFirebaseAuth } from '@/lib/firebase-admin-init';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getR2Client } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for export/[exportId] API');
} catch (error) {
  console.error('❌ Firebase initialization failed in export/[exportId] API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

export async function GET(
  request: Request,
  { params }: any
) {
  const { exportId } = params;
  
  if (!exportId) {
    return NextResponse.json({ message: 'Export ID is required' }, { status: 400 });
  }

  try {
    // Apply rate limiting - 5 requests per 10 seconds per user/IP
    // More restrictive for downloads as they're larger resources
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

    // Get export data from Firestore
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const exportDoc = await db.collection('exports').doc(exportId).get();
    
    if (!exportDoc.exists) {
      return NextResponse.json({ message: 'Export not found' }, { status: 404 });
    }
    
    const exportData = exportDoc.data();
    
    // Verify ownership
    if (exportData?.userId !== auth.userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not have access to this export' }, { status: 403 });
    }
    
    // Log export metadata to help with debugging
    console.log(`Serving export ${exportId} with metadata:`, {
      hasR2Key: !!exportData?.r2Key,
      fileName: exportData?.fileName,
      fileSize: exportData?.fileSize,
      hasLegacyContent: !!exportData?.exportContent,
      contentType: exportData?.contentType
    });

    // Check if export uses R2 for storage (newer exports) or has content directly in Firestore (older exports)
    if (exportData?.r2Key) {
      try {
        console.log(`Retrieving export from R2 with key: ${exportData.r2Key}`);
        
        // Fetch from Cloudflare R2
        const client = getR2Client();
        if (!client) {
          return NextResponse.json({ error: 'R2 client not configured' }, { status: 500 });
        }
        
        const command = new GetObjectCommand({
          Bucket: process.env.CF_R2_BUCKET_NAME,
          Key: `exports/${exportId}.zip`,
        });

        const { Body } = await client.send(command);
        if (!Body) {
          return NextResponse.json({ error: 'Export not found' }, { status: 404 });
        }

        const blob = await Body.transformToByteArray();
        const response = new NextResponse(blob, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${exportId}.zip"`,
          },
        });
        
        // Add rate limit headers to response
        if (rateLimitResult.headers) {
          Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
            response.headers.set(key, value as string);
          });
        }
        
        return response;
      } catch (error) {
        console.error('Error retrieving export from R2:', error);
        
        // Check for specific R2/S3 errors
        if (error instanceof Error) {
          console.error('Error:', error.name, error.message);
          
          // Check for common S3 errors
          if (error.name === 'NoSuchKey') {
            return NextResponse.json({
              message: 'Export file not found in storage (key does not exist)',
              errorCode: 'NO_SUCH_KEY'
            }, { status: 404 });
          }
          
          if (error.name === 'AccessDenied') {
            return NextResponse.json({
              message: 'Access denied to storage bucket',
              errorCode: 'ACCESS_DENIED'
            }, { status: 403 });
          }
        }
        
        return NextResponse.json({ 
          message: `Failed to retrieve export from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorCode: 'STORAGE_ERROR' 
        }, { status: 502 });
      }
    } else if (exportData?.exportContent) {
      // Legacy: Use content directly from Firestore
      const exportContent = exportData?.exportContent;
      console.log('Using legacy export content from Firestore');
      
      const response = NextResponse.json({
        ...exportData,
        fromR2: false
      });
      
      // Add rate limit headers to response
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          response.headers.set(key, value as string);
        });
      }
      
      return response;
    } else {
      return NextResponse.json({ message: 'Export content not found' }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Error fetching export:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    // Check for storage-related errors
    if (message.includes('storage') || message.includes('R2')) {
      return NextResponse.json({ message: `Storage error: ${message}` }, { status: 502 });
    }
    
    return NextResponse.json({ message: `Failed to fetch export: ${message}` }, { status: 500 });
  }
}
