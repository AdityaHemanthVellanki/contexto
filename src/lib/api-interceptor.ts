import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/toast';

/**
 * Hook to intercept API 401/403 errors globally and handle authentication issues
 * This should be used in the main layout component to catch auth errors app-wide
 */
export function useApiErrorInterceptor() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Save original fetch function
    const originalFetch = window.fetch;
    
    // Override fetch to add interceptor
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Check for authentication errors
        if (response.status === 401 || response.status === 403) {
          // Clone the response since we can only read it once
          const clonedResponse = response.clone();
          
          try {
            // Try to parse error message
            const errorData = await clonedResponse.json();
            const errorMessage = errorData.error || 'Authentication error. Please sign in again.';
            
            // Show toast notification
            toast({
              title: 'Session Expired',
              description: errorMessage,
              variant: 'destructive',
              duration: 5000
            });
          } catch (e) {
            // If parsing fails, show generic message
            toast({
              title: 'Authentication Error',
              description: 'Your session has expired. Please sign in again.',
              variant: 'destructive',
              duration: 5000
            });
          }
          
          // Sign out and redirect to sign in
          await signOut();
          router.push('/signin');
        }
        
        return response;
      } catch (error) {
        // Re-throw network errors for components to handle
        throw error;
      }
    };
    
    // Restore original fetch on cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, [signOut, router, toast]);
}
