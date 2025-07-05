'use client';

import React, { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { FiLogOut, FiMail } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

export default function AuthButton() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      if (isSignUp) {
        response = await signUpWithEmail(email, password);
      } else {
        response = await signInWithEmail(email, password);
      }

      if (response.error) {
        setError(response.error.message || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // If user is logged in, show sign out button
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {user.email}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors bg-gray-100 rounded-md dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <FiLogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    );
  }

  // If user is not logged in, show sign in options
  return (
    <div className="flex items-center gap-2">
      {showEmailForm ? (
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-2 p-3 bg-white rounded-md shadow-md dark:bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">{isSignUp ? 'Sign Up' : 'Sign In'}</h3>
            <button 
              type="button" 
              onClick={() => setShowEmailForm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
          
          {error && <p className="text-xs text-red-500">{error}</p>}
          
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="px-3 py-2 text-sm border border-gray-300 rounded-md dark:border-gray-700 dark:bg-gray-900"
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="px-3 py-2 text-sm border border-gray-300 rounded-md dark:border-gray-700 dark:bg-gray-900"
          />
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <FiMail className="w-4 h-4" />
            )}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
          
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      ) : (
        <>
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors bg-white rounded-md shadow-sm dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FcGoogle className="w-4 h-4" />
            Sign In with Google
          </button>
          
          <button
            onClick={() => setShowEmailForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600"
          >
            <FiMail className="w-4 h-4" />
            Sign In with Email
          </button>
        </>
      )}
    </div>
  );
}
