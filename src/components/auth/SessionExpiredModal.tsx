'use client';

import { useState } from 'react';
import { FiAlertCircle, FiLock } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SessionExpiredModal({ isOpen, onClose }: SessionExpiredModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  
  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Clear any stale auth tokens
      sessionStorage.removeItem('authToken');
      
      // Use the signInWithGoogle function from AuthContext
      // which handles sign-out and sign-in internally
      await signInWithGoogle();
      
      // Successfully signed in
      
      onClose();
    } catch (error) {
      console.error('Failed to sign in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
      >
        <div className="flex items-center mb-4 text-yellow-500">
          <FiAlertCircle className="w-6 h-6 mr-2" />
          <h3 className="text-lg font-semibold">Session Expired</h3>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Your session has expired. Please sign in again to continue.
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Don't worry, we've kept your work in progress. You'll be right back where you left off after signing in.
          </p>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Signing In...
              </>
            ) : (
              <>
                <FiLock className="mr-2" />
                Sign In
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
