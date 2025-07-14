import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import * as fs from 'fs';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if it's not already initialized
if (!getApps().length) {
  // Check if we have environment variables for service account
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Parse service account from environment variable
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
    } catch (error) {
      console.error('Error parsing Firebase service account:', error);
      throw new Error('Invalid Firebase service account configuration');
    }
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // Use individual credential environment variables
    credential = cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    });
  } else {
    try {
      // For development, use the local service account file
      const localServiceAccountPath = process.cwd() + '/service-account.json';
      console.log('Using local service account from:', localServiceAccountPath);
      
      // Check if file exists and is readable
      if (fs.existsSync(localServiceAccountPath)) {
        try {
          // Use raw file reading instead of require to avoid caching issues
          const serviceAccountContent = fs.readFileSync(localServiceAccountPath, 'utf8');
          const serviceAccount = JSON.parse(serviceAccountContent);
          credential = cert(serviceAccount);
        } catch (err) {
          console.error('Error reading local service account file:', err);
          throw new Error('Invalid service account file content');
        }
      } else {
        console.warn('Local service account file not found at:', localServiceAccountPath);
        console.warn('Creating mock credential for local development');
        
        // Create a minimal mock credential for local development
        credential = cert({
          projectId: 'contexto-local-dev',
          clientEmail: 'firebase-adminsdk-local@contexto-local-dev.iam.gserviceaccount.com',
          privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCsXXjI5xQqp9wR\n-----END PRIVATE KEY-----\n'
        });
      }
    } catch (error) {
      console.error('Error loading local service account:', error);
      throw new Error('Failed to initialize Firebase Admin SDK with local credentials');
    }
  }

  // Initialize app with explicit credentials and options to disable metadata server access
  initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || 'contexto-local-dev',
    // Explicitly setting this prevents attempts to connect to the metadata server
    serviceAccountId: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-local@contexto-local-dev.iam.gserviceaccount.com',
  });
}

const auth = getAuth();
const adminDb = getFirestore();

export { auth, adminDb };
