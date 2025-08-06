import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Check for Firebase configuration variables
 * Log warnings if variables are missing but don't throw errors
 * For production readiness, we want the app to attempt initialization
 */
const checkFirebaseConfig = () => {
  // Required Firebase environment variables
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(
      `Warning: Missing Firebase environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env file or environment configuration.`
    );
    return false;
  }
  return true;
};

// Check Firebase configuration
const configValid = checkFirebaseConfig();

// Firebase configuration with fallbacks for development
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000'
};

/**
 * Firebase singleton instance
 */
class Firebase {
  private static instance: Firebase;
  private _app: FirebaseApp;
  private _auth: Auth;
  private _db: Firestore;
  
  private constructor() {
    // Initialize Firebase app if not already initialized
    try {
      if (!getApps().length) {
        this._app = initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
      } else {
        this._app = getApp();
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      // Still try to get existing app as fallback
      this._app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    }
    
    // Initialize services
    this._auth = getAuth(this._app);
    this._db = getFirestore(this._app);
  }
  
  public static getInstance(): Firebase {
    if (!Firebase.instance) {
      Firebase.instance = new Firebase();
    }
    return Firebase.instance;
  }
  
  // Getters for Firebase services
  get app(): FirebaseApp {
    return this._app;
  }
  
  get auth(): Auth {
    return this._auth;
  }
  
  get db(): Firestore {
    return this._db;
  }
}

// Initialize Firebase singleton
const firebaseInstance = Firebase.getInstance();

// Export Firebase services
export const app = firebaseInstance.app;
export const auth = firebaseInstance.auth;
export const db = firebaseInstance.db;

// Default export for convenience
export default firebaseInstance;
