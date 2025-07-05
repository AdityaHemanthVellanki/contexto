/**
 * DEPRECATION NOTICE:
 * This file is maintained for backwards compatibility during migration.
 * All new code should use the Firebase utilities directly.
 * This file will be removed in a future update.
 */

import { auth, db } from './firebase';

// Provides a compatibility layer for old code during the migration period
export const supabase = {
  auth: {
    // Redirect to Firebase auth methods
    getUser: async () => {
      console.warn('Using deprecated Supabase auth.getUser() method. Please update to Firebase.');
      const currentUser = auth.currentUser;
      return { 
        data: { user: currentUser },
        error: null
      };
    },
    signOut: async () => {
      console.warn('Using deprecated Supabase auth.signOut() method. Please update to Firebase.');
      await auth.signOut();
      return { error: null };
    },
    // Add more compatibility methods as needed
  }
};
