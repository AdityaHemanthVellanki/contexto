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
    // Get auth header - with various fallback approaches
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    // Development bypass for easy testing - ONLY for non-production environments
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_BYPASS === 'true') {
      console.log('DEV MODE: Using development auth bypass');
      return {
        authenticated: true,
        userId: 'dev-user-123',
        token: 'dev-token'
      };
    }
    
    // If no auth header, but we're in development, we can use a dev token
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && isDev) {
      console.log('DEV MODE: Missing auth header, using development credentials');
      return {
        authenticated: true,
        userId: 'dev-user-123',
        token: 'dev-token'
      };
    }
    
    // For production, enforce proper auth header
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
    
    // In development without proper service accounts, we can validate token format
    // and extract user ID from the token without full verification
    // WARNING: Only do this in development!
    // Default to simplified validation in development unless explicitly disabled
    if (isDev && process.env.NEXT_PUBLIC_SKIP_API_AUTH_VERIFICATION !== 'false') {
      try {
        // Basic check that the token is properly formatted
        const parts = token.split('.');
        
        // Handle both JWT and custom token formats
        if (parts.length === 3) {
          // Standard JWT format
          try {
            // Extract payload (this is not secure, only for development)
            // Handle padding issues with base64
            const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const paddedBase64 = base64Payload.padEnd(base64Payload.length + (4 - base64Payload.length % 4) % 4, '=');
            const payload = JSON.parse(Buffer.from(paddedBase64, 'base64').toString());
            
            console.log('DEV MODE: JWT payload fields:', Object.keys(payload));
            
            // Check for user ID in various formats
            if (!payload.user_id && !payload.sub && !payload.uid && !payload.user_id) {
              // If no user ID found, use a development user ID
              console.warn('DEV MODE: No user ID found in token, using development user ID');
              return {
                authenticated: true,
                userId: 'dev-user-123',
                token
              };
            }
            
            const userId = payload.user_id || payload.sub || payload.uid;
            
            console.log('DEV MODE: Using simplified token validation, user ID:', userId);
            
            return {
              authenticated: true,
              userId,
              token
            };
          } catch (decodeError) {
            console.error('DEV MODE: Error decoding JWT payload:', decodeError);
            // Fall through to use development user ID
          }
        }
        
        // For malformed tokens in development, just allow access with a dev user ID
        console.warn('DEV MODE: Using development user ID for malformed token');
        return {
          authenticated: true,
          userId: 'dev-user-123',
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
    
    // Normal production verification with better error handling
    try {
      // Check if Firebase Admin is properly initialized first
      // This can happen if environment variables are missing
      let auth;
      try {
        auth = getAuth();
      } catch (initError) {
        console.error('Firebase Admin initialization error:', initError);
        
        // In development, allow bypass if Firebase Admin fails to initialize
        if (isDev) {
          console.warn('DEV MODE: Bypassing Firebase Admin initialization failure');
          return {
            authenticated: true,
            userId: 'dev-user-123',
            token
          };
        } else {
          throw new Error('Firebase Admin initialization failed');
        }
      }
      
      // Add clock tolerance to account for slight time differences between client and server
      const decodedToken = await auth.verifyIdToken(token)
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
    } catch (error: any) {
      // Better error logging for debugging
      console.error('Token verification failed:', error?.code || error?.message || 'Unknown error');
      
      // Special handling for common Firebase auth errors
      const errorCode = error?.code || '';
      
      // For expired tokens, send a special error so the client knows to refresh
      if (errorCode === 'auth/id-token-expired') {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Token expired', code: 'TOKEN_EXPIRED' },
            { status: 401 }
          )
        };
      }
      
      // For development mode, provide a dev bypass option as a fallback
      if (isDev && process.env.NEXT_PUBLIC_BYPASS_FAILED_VERIFICATION === 'true') {
        console.warn('DEV MODE: Bypassing failed verification with dev user');
        return {
          authenticated: true,
          userId: 'dev-user-123',
          token
        };
      }
      
      // Default case - return authentication failure
      return {
        authenticated: false,
        response: NextResponse.json(
          { message: 'Unauthorized: Invalid token' },
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
