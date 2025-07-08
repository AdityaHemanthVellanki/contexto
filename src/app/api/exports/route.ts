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

    // Query exports collection for user's exports
    const exportsRef = db.collection('exports');
    const query = exportsRef.where('userId', '==', userId).orderBy('exportedAt', 'desc');
    const snapshot = await query.get();

    const exports = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        exportId: doc.id,
        pipelineId: data.pipelineId,
        fileName: data.fileName || 'MCP Export',
        contentType: data.contentType || 'application/zip',
        fileSize: data.fileSize || 0,
        exportedAt: data.exportedAt ? data.exportedAt.toDate() : new Date()
        // Note: exportContent is not returned in the list to reduce payload size
        // It will be fetched separately when needed via the /api/export/[exportId] endpoint
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
