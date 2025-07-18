/**
 * Firebase Admin SDK Configuration Helper
 * 
 * This file provides configuration options for Firebase Admin SDK,
 * allowing fallback to client-side Firebase config when server-side
 * environment variables are not available.
 */

// Standard server-side environment variables (preferred)
export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
  useEmulator?: boolean;
}

export const getFirebaseAdminConfig = (): FirebaseAdminConfig => {
  // Use explicit server-side config if available
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    };
  }
  
  // If FIREBASE_ADMIN_CREDENTIALS is provided as a JSON string, use that
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      return {
        projectId: credentials.project_id || credentials.projectId,
        clientEmail: credentials.client_email || credentials.clientEmail,
        privateKey: credentials.private_key || credentials.privateKey,
        storageBucket: credentials.storage_bucket || credentials.storageBucket,
      };
    } catch (error) {
      console.error('Error parsing FIREBASE_ADMIN_CREDENTIALS:', error);
    }
  }
  
  // Fall back to client-side config for project ID
  // NOTE: This requires setting up a service account separately
  // This is a fallback to at least get the project ID
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
      privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
      useEmulator: process.env.NODE_ENV === 'development',
    };
  }
  
  // Last resort: return empty config and let the application handle the error
  const projectId = '';
  const clientEmail = '';
  const privateKey = '';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 
                        (projectId ? `${projectId}.appspot.com` : undefined) ||
                        process.env.CF_R2_BUCKET_NAME || // Try to use R2 bucket as fallback
                        'contexto-uploads';

  console.log(`Firebase Storage Bucket: ${storageBucket}`);

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket,
  };
};
