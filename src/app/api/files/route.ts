import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getFirestore } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      windowSizeInSeconds: 60
    });
    
    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found' }, { status: 400 });
    }

    // Get user's uploaded files
    const db = getFirestore();
    const uploadsRef = db.collection('uploads');
    const snapshot = await uploadsRef
      .where('userId', '==', userId)
      .orderBy('uploadedAt', 'desc')
      .get();
    
    const files = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate?.()?.toISOString() || null
    }));

    const response = NextResponse.json(files);
    
    // Add rate limit headers
    if (rateLimitResult.headers) {
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
    }

    return response;
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { message: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
