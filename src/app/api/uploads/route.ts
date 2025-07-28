import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { authenticateRequest } from '@/lib/api-auth';
import { Firestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for uploads API');
} catch (error) {
  console.error('❌ Firebase initialization failed in uploads API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - 10 requests per 5 seconds per user/IP
    const identifier = request.headers.get('x-user-id') || request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = await rateLimit(identifier, {
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
      return NextResponse.json({ 
        message: 'Authentication required to access user uploads' 
      }, { status: 401 });
    }
    
    const userId = auth.userId;

    try {
      // Use our shared Firebase Admin initialization module
      const db = initializeFirebaseAdmin();
      
      // Verify database connection
      if (!db) {
        throw new Error('Database connection unavailable');
      }

      // Query uploads collection for user's files
      const uploadsRef = db.collection('uploads');
      
      // Simple defensive check to ensure collections exist
      if (!uploadsRef) {
        throw new Error('Uploads collection not accessible');
      }
      
      const query = uploadsRef.where('userId', '==', userId).orderBy('uploadedAt', 'desc');
      const snapshot = await query.get();

      const uploads = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          fileId: doc.id,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          uploadedAt: data.uploadedAt ? data.uploadedAt.toDate() : new Date(),
          status: data.status || 'ready'
        };
      });
      
      const response = NextResponse.json({ uploads });
      
      // Add rate limit headers to response
      if (rateLimitResult.headers) {
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          response.headers.set(key, value as string);
        });
      }
      
      return response;
    } catch (firestoreError) {
      // Handle specific Firestore errors
      console.error('Firestore error:', firestoreError);
      const errMsg = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
      
      // Authentication/credentials error
      if (errMsg.includes('credential') || errMsg.includes('permission') || 
          errMsg.includes('authentication') || errMsg.includes('auth')) {
        return NextResponse.json({ 
          message: 'Database authentication error. Server credentials are misconfigured.',
          error: 'auth_error'
        }, { status: 500 });
      }
      
      // Not found error
      if (errMsg.includes('not found') || errMsg.includes('exist')) {
        return NextResponse.json({
          message: 'The requested resource was not found',
          error: 'not_found'
        }, { status: 404 });
      }

      // Rate limiting or quota exceeded
      if (errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('limit')) {
        return NextResponse.json({
          message: 'Database quota exceeded or rate limit reached',
          error: 'quota_exceeded'
        }, { status: 429 });
      }
      
      // Generic Firestore error
      return NextResponse.json({ 
        message: 'Database operation failed', 
        error: 'db_error',
        details: process.env.NODE_ENV === 'development' ? errMsg : undefined
      }, { status: 500 });
    }
  } catch (error) {
    // Handle general API errors
    console.error('Error in uploads API:', error);
    const message = error instanceof Error ? error.message : String(error);
    
    // User authentication error
    if (message.toLowerCase().includes('auth') || 
        message.toLowerCase().includes('token') || 
        message.toLowerCase().includes('permission')) {
      return NextResponse.json({ 
        message: 'You are not authorized to access this resource',
        error: 'unauthorized'
      }, { status: 401 });
    }
    
    // General server error - don't expose internal details in production
    return NextResponse.json({ 
      message: 'An unexpected error occurred while processing your request',
      error: 'server_error',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    }, { status: 500 });
  }
}
