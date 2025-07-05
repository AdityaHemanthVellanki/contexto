import { initializeApp, cert, getApps } from 'firebase-admin/app';
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
    // For development or if running in a Firebase environment that provides credentials
    console.warn('No explicit Firebase credentials provided - using application default credentials');
  }

  // Initialize app with or without explicit credentials
  initializeApp(credential ? { credential } : {});
}

const auth = getAuth();
const adminDb = getFirestore();

export { auth, adminDb };
