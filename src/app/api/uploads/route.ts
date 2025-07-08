import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter';

// Initialize Firebase Admin services
const db = getFirestore();

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting - 10 requests per 5 seconds per user/IP
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      windowSizeInSeconds: 5
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

    // Query uploads collection for user's files
    const uploadsRef = db.collection('uploads');
    const query = uploadsRef.where('userId', '==', userId).orderBy('uploadedAt', 'desc');
    const snapshot = await query.get();

    const uploads = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        fileId: doc.id,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        uploadedAt: data.uploadedAt ? data.uploadedAt.toDate() : new Date(),
        status: data.status || 'ready'
        // Note: fileContent is not returned in the list to reduce payload size
        // It will be fetched separately when needed
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
  } catch (error) {
    console.error('Error fetching uploads:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    return NextResponse.json({ message: `Failed to fetch uploads: ${message}` }, { status: 500 });
  }
}
