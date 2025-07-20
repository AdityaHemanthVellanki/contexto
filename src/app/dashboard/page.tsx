'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';
import ChatWindow from '@/components/chat/ChatWindow';

// Define animations
const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Set isLoading to false after initialization
  useEffect(() => {
    // Set a short timeout to ensure initial rendering is complete
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Authentication and token refresh mechanism
  useEffect(() => {
    // If still loading auth state, don't do anything yet
    if (authLoading) {
      console.log('Auth state is still loading, waiting...');
      return;
    }

    // Once auth loading is complete, check if user exists
    if (!user) {
      console.log('No user found after auth loaded, redirecting to signin');
      router.push('/signin');
      return;
    }
    
    // If user is authenticated, implement token refresh mechanism
    if (user) {
      console.log('User authenticated in dashboard, setting up token refresh');
      
      // Immediate token refresh on page load to ensure fresh token
      (async () => {
        try {
          const token = await user.getIdToken(true);
          console.log('Token refreshed successfully on dashboard load');
          
          // Store token in sessionStorage for API calls
          sessionStorage.setItem('authToken', token);
        } catch (error) {
          console.error('Failed to refresh token on dashboard load:', error);
        }
      })();
      
      // Set up periodic token refresh (every 10 minutes)
      const tokenRefreshInterval = setInterval(async () => {
        try {
          if (user) {
            const token = await user.getIdToken(true);
            console.log('Periodic token refresh successful');
            sessionStorage.setItem('authToken', token);
          }
        } catch (error) {
          console.error('Periodic token refresh failed:', error);
        }
      }, 10 * 60 * 1000); // 10 minutes
      
      return () => {
        clearInterval(tokenRefreshInterval);
      };
    }
  }, [user, authLoading, router]);
  
  // Note: Export functionality is handled internally by the ChatWindow component
  // This is just a reference implementation if we need to handle exports at the Dashboard level
  const handleExportFromDashboard = async () => {
    if (!user) {
      setError('You must be logged in to export a pipeline');
      return;
    }
    
    try {
      // Call the export API with the user's session ID
      const response = await fetch(`/api/exportPipeline?sessionId=${user.uid}`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `contexto-pipeline-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: 'Export Successful',
        description: 'Pipeline configuration has been exported.',
        variant: 'success',
      });
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Failed to export pipeline');
      
      toast({
        title: 'Export Failed',
        description: 'Could not export pipeline configuration.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <motion.div
        className="flex flex-col flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
      >
        {/* Main Content */}
        <div className="flex-1 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="text-red-500 mb-4 text-lg">
                {error}
              </div>
              <button
                onClick={() => setError(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="w-full h-full">
              {/* Full-width ChatWindow */}
              <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <ChatWindow />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-auto pt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Contexto. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}
