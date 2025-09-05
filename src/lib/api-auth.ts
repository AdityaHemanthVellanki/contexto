import { NextResponse } from 'next/server';
import { getFirebaseAuth } from './firebase-admin-init';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Helper function to authenticate and authorize API requests
 * Works in both development and production environments
 */
export async function authenticateRequest(request: Request): Promise<{
  authenticated: boolean;
  userId?: string;
  token?: string;
  decodedToken?: DecodedIdToken;
  response?: NextResponse;
}> {
  try {
    // Get auth header - with various fallback approaches
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    // Production-ready authentication requires proper headers
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { message: 'Unauthorized: Missing or invalid authentication token' },
          { status: 401 }
        )
      };
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Production verification with proper error handling
    try {
      // Get Firebase Auth instance using our helper function
      // This ensures Firebase Admin is initialized first
      const auth = getFirebaseAuth();
      console.log('✅ Firebase Auth initialized successfully in authenticateRequest');
      
      // Verify the token with Firebase
      const decodedToken = await auth.verifyIdToken(token, true); // Force token refresh check
      const userId = decodedToken.uid;
      
      // Ensure we have a valid user ID
      if (!userId) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Unauthorized: Invalid user identifier' },
            { status: 401 }
          )
        };
      }
      
      // Add additional security checks if needed
      // For example, check if user is disabled or has required roles
      if (decodedToken.disabled === true) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Unauthorized: User account is disabled' },
            { status: 403 }
          )
        };
      }
      
      // Authentication successful
      return {
        authenticated: true,
        userId,
        token,
        decodedToken
      };
    } catch (error: unknown) {
      // Handle specific Firebase Auth errors with proper type checking
      const errorCode = error instanceof Error && 'code' in error ? (error as any).code : '';
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      
      // Log detailed error information for debugging
      console.error('❌ Authentication error:', {
        code: errorCode,
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Handle Firebase initialization errors specifically
      if (errorMessage.includes('Firebase initialization failed') || 
          errorMessage.includes('default Firebase app does not exist')) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { 
              message: 'Server configuration error', 
              details: 'Firebase initialization failed',
              code: 'FIREBASE_INIT_ERROR'
            },
            { status: 500 }
          )
        };
      }
      
      // For expired tokens, send a specific error code
      if (errorCode === 'auth/id-token-expired' || errorMessage.includes('expired')) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Authentication failed: Token expired', code: 'TOKEN_EXPIRED' },
            { status: 401 }
          )
        };
      }
      
      // For revoked tokens
      if (errorCode === 'auth/id-token-revoked' || errorMessage.includes('revoked')) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Authentication failed: Token revoked', code: 'TOKEN_REVOKED' },
            { status: 401 }
          )
        };
      }
      
      // For invalid tokens
      if (errorMessage.includes('invalid')) {
        return {
          authenticated: false,
          response: NextResponse.json(
            { message: 'Authentication failed: Invalid token', code: 'INVALID_TOKEN' },
            { status: 401 }
          )
        };
      }
      
      // Log detailed error for debugging but don't expose internals
      console.error('Token verification failed:', { code: errorCode, message: errorMessage });
      
      // Default error response
      return {
        authenticated: false,
        response: NextResponse.json(
          { message: 'Authentication failed' },
          { status: 401 }
        )
      };
    }
  } catch (error) {
    // Critical server errors - something went wrong with our code
    console.error('Authentication system error:', error);
    
    return {
      authenticated: false,
      response: NextResponse.json(
        { message: 'Authentication service unavailable' },
        { status: 500 }
      )
    };
  }
}
