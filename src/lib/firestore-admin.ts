/**
 * DEPRECATED: This file is kept for backward compatibility.
 * New code should use firebase-admin-init.ts instead.
 */
import { getFirestoreInstance } from './firebase-admin-init';
import type { Firestore } from 'firebase-admin/firestore';

// For backward compatibility, re-export the getFirestoreInstance as getFirestoreAdmin
console.log('⚠️ Using deprecated firestore-admin.ts module. Please update to firebase-admin-init.ts');


/**
 * Get the Firestore instance - redirects to the new shared module
 */
export function getFirestoreAdmin(): Firestore {
  // Simply redirect to the new shared module
  return getFirestoreInstance();
}

/**
 * Export the singleton Firestore instance directly
 * This maintains backward compatibility with existing code
 */
export const firestore = getFirestoreInstance();
