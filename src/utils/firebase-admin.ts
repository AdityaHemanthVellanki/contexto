import admin, { ServiceAccount } from 'firebase-admin';
import * as fs from 'fs';
import { getServerEnv } from '@/lib/env-utils';

// Get environment variables with proper typing
const env = getServerEnv();

// Define a custom interface that extends NodeJS.Process
interface CustomNodeProcess extends NodeJS.Process {
  cwd(): string;
}

declare const process: CustomNodeProcess;

// Helper to get the project root directory
const getProjectRoot = (): string => {
  try {
    // In Node.js environment, we can use __dirname or process.cwd()
    if (typeof __dirname !== 'undefined') {
      return process.cwd();
    }
    // For other environments, try to get it from process.cwd()
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      return process.cwd();
    }
  } catch (error) {
    console.warn('Could not determine project root:', error);
  }
  // Fallback to current directory
  return '.';
};

/**
 * Singleton Firebase Admin SDK initialization
 * This ensures that both initializeApp() and firestore.settings() are called only once
 * at the module level, preventing the "Firestore has already been initialized" errors
 */

// Initialize Firebase Admin SDK if it's not already initialized
if (!admin.apps.length) {
  console.log('Initializing Firebase Admin SDK...');
  
  // Check if we have environment variables for service account
  let credential: admin.credential.Credential | undefined;
  
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Parse service account from environment variable
    try {
      const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY) as ServiceAccount;
      credential = admin.credential.cert(serviceAccount);
    } catch (error) {
      console.error('Error parsing Firebase service account:', error);
      throw new Error('Invalid Firebase service account configuration');
    }
  } else if (
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    // Use individual credential environment variables
    credential = admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'),
    } as ServiceAccount);
  } else {
    try {
      // For development, use the local service account file
      const projectRoot = getProjectRoot();
      const localServiceAccountPath = `${projectRoot}/service-account.json`;
      console.log('Using local service account from:', localServiceAccountPath);
      
      // Check if file exists and is readable
      if (fs.existsSync(localServiceAccountPath)) {
        try {
          // Use raw file reading instead of require to avoid caching issues
          const serviceAccountContent = fs.readFileSync(localServiceAccountPath, 'utf8');
          const serviceAccount = JSON.parse(serviceAccountContent) as ServiceAccount;
          credential = admin.credential.cert(serviceAccount);
        } catch (error) {
          console.error('Error reading service account file:', error);
          throw new Error('Failed to read service account file');
        }
      } else {
        console.error('No Firebase service account found. Please set FIREBASE_SERVICE_ACCOUNT_KEY or provide individual credentials.');
        throw new Error('Firebase service account not configured');
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      throw error;
    }
  }

  if (!credential) {
    throw new Error('Failed to initialize Firebase Admin credentials');
  }

  try {
    // Initialize Firebase Admin with the appropriate configuration
    const firebaseConfig: admin.AppOptions = {
      credential,
      projectId: env.FIREBASE_PROJECT_ID,
      // Use optional chaining and fallbacks for client-side environment variables
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
      storageBucket: env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    };

    admin.initializeApp(firebaseConfig);
    
    // Configure Firestore settings
    const firestore = admin.firestore();
    firestore.settings({
      ignoreUndefinedProperties: true,
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

// Export the singleton instances
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;
