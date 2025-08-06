'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import { auth } from '@/utils/firebase';

// Define the shape of the auth context data
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ data: any | null; error: any | null }>;
}

// Create the auth context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps the app and makes auth object available to any child component that calls useAuth()
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state and persistence when the component mounts
  useEffect(() => {
    // Set Firebase persistence to LOCAL (persists even when browser is closed)
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('Firebase persistence set to LOCAL');
      } catch (error) {
        console.error('Error setting persistence:', error);
      }
    })();
    
    // Set up a subscription to watch for auth changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      
      // Log authentication state changes
      if (currentUser) {
        console.log('User authenticated:', currentUser.uid);
        
        // Refresh token immediately and store in session storage for API calls
        currentUser.getIdToken(true).then(
          token => {
            console.log('Token refreshed successfully on auth state change');
            sessionStorage.setItem('authToken', token);
            
            // Set up token refresh interval (every 10 minutes) to ensure token doesn't expire
            // This helps keep the session alive even during long periods of inactivity
            const tokenRefreshInterval = setInterval(() => {
              if (auth.currentUser) {
                auth.currentUser.getIdToken(true)
                  .then(refreshedToken => {
                    console.log('Token refreshed by interval');
                    sessionStorage.setItem('authToken', refreshedToken);
                  })
                  .catch(err => console.error('Interval token refresh failed:', err));
              } else {
                clearInterval(tokenRefreshInterval);
              }
            }, 10 * 60 * 1000); // Refresh every 10 minutes
            
            // Clean up interval on component unmount
            return () => clearInterval(tokenRefreshInterval);
          },
          error => console.error('Initial token refresh failed:', error)
        );
      } else {
        console.log('No user authenticated');
        // Clear any stored tokens when user is not authenticated
        sessionStorage.removeItem('authToken');
      }
    });

    // Clean up the subscription when component unmounts
    return () => unsubscribe();
  }, []);

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    try {
      // Make sure persistence is set every time before sign-in
      await setPersistence(auth, browserLocalPersistence);
      
      const provider = new GoogleAuthProvider();
      // Add more scopes if needed for token durability
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');
      provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
      
      // Force refreshing of OAuth tokens
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      
      // Force token refresh immediately to ensure it's fresh
      await result.user.getIdToken(true);
      
      console.log('Google sign-in successful');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      // Make sure persistence is set every time before sign-in
      await setPersistence(auth, browserLocalPersistence);
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Force token refresh immediately to ensure it's fresh
      await result.user.getIdToken(true);
      
      console.log('Email sign-in successful');
      router.push('/dashboard');
      return { error: null };
    } catch (error) {
      console.error('Error signing in with email:', error);
      return { error };
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      // Make sure persistence is set every time before sign-up
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Force token refresh immediately to ensure it's fresh
      await userCredential.user.getIdToken(true);
      
      console.log('Email sign-up successful');
      router.push('/dashboard');
      return { data: userCredential.user, error: null };
    } catch (error) {
      console.error('Error signing up with email:', error);
      return { error, data: null };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Provide the auth context to children components
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithGoogle,
        signOut,
        signInWithEmail,
        signUpWithEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
