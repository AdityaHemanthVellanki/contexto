/**
 * Firebase Admin SDK Configuration Helper
 * 
 * This file provides configuration options for Firebase Admin SDK,
 * allowing fallback to client-side Firebase config when server-side
 * environment variables are not available.
 */

import { getServerEnv } from './env-utils';
import admin from 'firebase-admin';

interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
  useEmulator?: boolean;
}

type EnvVars = ReturnType<typeof getServerEnv>;

function getRequiredEnvVar<K extends keyof EnvVars>(key: K): string {
  const value = getServerEnv()[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return String(value);
}

export const getFirebaseAdminConfig = (): FirebaseAdminConfig => {
  const env = getServerEnv();
  
  // Try to use FIREBASE_ADMIN_CREDENTIALS if available
  if (env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
      const credentials = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS);
      const projectId = credentials.project_id || credentials.projectId;
      const clientEmail = credentials.client_email || credentials.clientEmail;
      const privateKey = credentials.private_key || credentials.privateKey;
      
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing required fields in FIREBASE_ADMIN_CREDENTIALS');
      }
      
      return {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\\\n/g, '\\n'),
        storageBucket: env.FIREBASE_STORAGE_BUCKET,
        useEmulator: env.NODE_ENV === 'development',
      };
    } catch (error) {
      console.error('Error parsing FIREBASE_ADMIN_CREDENTIALS:', error);
      throw new Error('Invalid FIREBASE_ADMIN_CREDENTIALS environment variable');
    }
  }

  // Fall back to individual environment variables
  try {
    const projectId = getRequiredEnvVar('FIREBASE_PROJECT_ID');
    const clientEmail = getRequiredEnvVar('FIREBASE_CLIENT_EMAIL');
    const privateKey = getRequiredEnvVar('FIREBASE_PRIVATE_KEY');
    
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\\\n/g, '\\n'),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      useEmulator: env.NODE_ENV === 'development',
    };
  } catch (error) {
    throw new Error(
      'Missing required Firebase Admin configuration. ' +
      'Please set either FIREBASE_ADMIN_CREDENTIALS or the individual ' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY variables. ' +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

// Initialize Firebase Admin SDK
const adminApp = (() => {
  try {
    const config = getFirebaseAdminConfig();
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
      storageBucket: config.storageBucket,
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
})();

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();
