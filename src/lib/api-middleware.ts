import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
  userId: string;
}

/**
 * Middleware to authenticate API requests using Firebase ID tokens
 */
export function withAuth<T = any>(
  handler: (req: AuthenticatedRequest, context: { params: T }) => Promise<NextResponse>
) {
  // Note: we intentionally keep the returned handler's signature broad to satisfy Next.js Route types
  return async (req: Request, context: any) => {
    try {
      // Extract token from Authorization header
      const authHeader = (req as any).headers?.get?.('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Missing or invalid authorization header' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify the token
      const decodedToken = await verifyIdToken(token);
      
      // Add userId to request object
      const authenticatedReq = req as unknown as AuthenticatedRequest;
      authenticatedReq.userId = decodedToken.uid;
      
      // Call the handler with authenticated request and context
      return await handler(
        authenticatedReq,
        (context as { params: T }) ?? ({ params: {} as T } as { params: T })
      );
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

/**
 * Helper function to extract user ID from request
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyIdToken(token);
  return decodedToken.uid;
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Success response helper
 */
export function successResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}
