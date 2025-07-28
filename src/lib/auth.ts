import { getAuth } from '@/lib/firebase-admin';

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
