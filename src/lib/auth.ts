import { getAuth } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

/**
 * Verifies a Firebase ID token
 * @param token The Firebase ID token to verify
 * @returns A Promise resolving to the decoded token
 * @throws If the token is invalid
 */
export async function verifyIdToken(token: string) {
  try {
    const auth = await getAuth();
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid authentication token');
  }
}

/**
 * Gets the current user from the Firebase ID token
 * @param token The Firebase ID token
 * @returns A Promise resolving to the user ID
 * @throws If the token is invalid or no user is found
 */
export async function getUserFromToken(token: string) {
  try {
    const decodedToken = await verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    throw new Error('Failed to authenticate user');
  }
}

<<<<<<< HEAD
export const authOptions = {
  providers: [],
  callbacks: {
    session: async ({ session, token }: { session: any; token: any }) => {
      if (token) {
        session.user = token.user;
      }
      return session;
    },
  },
};
=======
/**
 * Ensures a request is authenticated by extracting and verifying the Firebase ID token
 * @param request The incoming request object
 * @returns A Promise resolving to the user ID
 * @throws If authentication fails
 */
export async function ensureAuthenticated(request: Request): Promise<string> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  return await getUserFromToken(token);
}

/**
 * Verifies authentication from a NextRequest object
 * @param request The Next.js request object
 * @returns An object with success status and either userId or error message
 */
export async function verifyAuth(request: NextRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // First check for token in authorization header
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else {
      // Check for token in query params (for SSE connections)
      const url = new URL(request.url);
      token = url.searchParams.get('token');
    }
    
    if (!token) {
      return { success: false, error: 'Missing authentication token' };
    }
    
    // Verify the token and get user ID
    const decodedToken = await verifyIdToken(token);
    return { success: true, userId: decodedToken.uid };
  } catch (error) {
    console.error('Authentication error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}
>>>>>>> db67cbcf19fab530d2b300d56dd527b2d7d1df52
