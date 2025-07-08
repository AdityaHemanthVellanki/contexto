import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter';

// Initialize Firebase Admin services
const db = getFirestore();

export async function GET(
  request: NextRequest,
  { params }: { params: { exportId: string } }
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
    if (rateLimitResult.limited && rateLimitResult.response) {
      return rateLimitResult.response;
    }
    
    // Authenticate request
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return auth.response;
    }
    
    const userId = auth.userId;

    // Get export document from Firestore
    const exportDoc = await db.collection('exports').doc(exportId).get();
    
    if (!exportDoc.exists) {
      return NextResponse.json({ message: 'Export not found' }, { status: 404 });
    }

    const exportData = exportDoc.data();
    
    // Check if this export belongs to the requesting user
    if (!exportData || exportData.userId !== userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not have access to this export' }, { status: 403 });
    }

    // Return the export content and metadata
    const response = NextResponse.json({
      exportId: exportDoc.id,
      pipelineId: exportData.pipelineId,
      fileName: exportData.fileName,
      exportContent: exportData.exportContent,
      contentType: exportData.contentType || 'application/octet-stream',
      exportedAt: exportData.exportedAt ? exportData.exportedAt.toDate() : new Date(),
      fileSize: exportData.fileSize || 0
    });
    
    // Add rate limit headers to response
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }
    
    return response;

  } catch (error) {
    console.error('Error fetching export:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    return NextResponse.json({ message: `Failed to fetch export: ${message}` }, { status: 500 });
  }
}
