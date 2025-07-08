import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from './firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Helper function to authenticate and authorize API requests
 * Works in both development and production environments
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  authenticated: boolean;
  userId?: string;
  token?: string;
  decodedToken?: DecodedIdToken;
  response?: NextResponse;
}> {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { message: 'Unauthorized: Missing or invalid token' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.split('Bearer ')[1];
    
    // For development with emulators, we might need special handling
    // This would depend on your local setup
    const isDev = process.env.NODE_ENV === 'development';
    
    // In development without proper service accounts, we can validate token format
    // and extract user ID from the token without full verification
    // WARNING: Only do this in development!
    if (isDev && process.env.NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION === 'true') {
      try {
        // Basic check that the token is properly formatted
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }
        
        // Extract payload (this is not secure, only for development)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        if (!payload.user_id && !payload.sub && !payload.uid) {
          throw new Error('Token payload missing user ID');
        }
        
        const userId = payload.user_id || payload.sub || payload.uid;
        
        console.log('DEV MODE: Using simplified token validation');
        
        return {
          authenticated: true,
          userId,
          token
        };
      } catch (error) {
        console.error('Error in dev token validation:', error);
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Unauthorized: Invalid token format' },
            { status: 401 }
          )
        };
      }
    }
    
    // Normal production verification
    try {
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      if (!userId) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Unauthorized: Invalid user' },
            { status: 401 }
          )
        };
      }
      
      return {
        authenticated: true,
        userId,
        token,
        decodedToken
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return {
        authenticated: false,
        response: NextResponse.json(
          { message: `Unauthorized: ${error instanceof Error ? error.message : 'Invalid token'}` },
          { status: 401 }
        )
      };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      authenticated: false,
      response: NextResponse.json(
        { message: 'Server authentication error' },
        { status: 500 }
      )
    };
  }
}
