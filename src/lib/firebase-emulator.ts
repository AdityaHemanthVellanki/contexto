/**
 * Firebase emulator configuration utilities
 * This helps connect to Firebase emulators in development environments
 */

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Configuration for Firebase emulators
export const emulatorConfig = {
  authEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  firestoreEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST,
  firestoreEmulatorPort: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT || '8080',
  functionsEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST,
  functionsEmulatorPort: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'
};

/**
 * Check if we should be using emulators based on environment
 */
export const shouldUseEmulators = isDev && (
  !!emulatorConfig.authEmulatorHost || 
  !!emulatorConfig.firestoreEmulatorHost
);

/**
 * Configure Firebase Admin to use local emulators if available
 * This should be called early in the API route handlers
 */
export function configureFirebaseAdminEmulators() {
  if (!shouldUseEmulators) return;

  // Set environment variables for Firebase Admin SDK to use emulators
  if (emulatorConfig.firestoreEmulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = `${emulatorConfig.firestoreEmulatorHost}:${emulatorConfig.firestoreEmulatorPort}`;
    console.log(`Firebase Admin using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }
  
  // Add other emulator configurations as needed
}
