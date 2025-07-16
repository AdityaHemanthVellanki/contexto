import { useState, useEffect, useCallback, useRef } from 'react';
import { FiDownload, FiLoader, FiRefreshCw, FiAlertCircle, FiLogIn, FiPackage } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { fetchWithAuth } from '@/lib/auth-interceptor';
import { auth } from '@/utils/firebase';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import SessionExpiredModal from '@/components/auth/SessionExpiredModal';

interface ExportItem {
  exportId: string;
  pipelineId: string;
  fileName: string;
  contentType?: string;
  fileSize?: number;
  exportedAt: string | Date;
}

interface ExportListProps {
  refreshTrigger?: number;
}

export default function ExportList({ refreshTrigger = 0 }: ExportListProps) {
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // Use refs to track the last fetch time and prevent excessive API calls
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Clean up function to prevent memory leaks and state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Handle download of an export
  const handleDownload = async (exportId: string, fileName: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    
    toast({
      title: 'Starting Download',
      description: 'Preparing your export...',
      variant: 'default',
      duration: 3000
    });
    
    try {
      const response = await fetchWithAuth(`/api/exports/${exportId}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName || `export-${exportId}.json`;
      
      // Append to document body, click, and clean up
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded successfully`,
        variant: 'default',
        duration: 3000
      });
      
    } catch (error) {
      console.error('Error downloading export:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: 'Download Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  // Main fetch function
  const fetchExports = useCallback(async () => {
    if (!user) return;
    
    // Debounce API calls
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    if (timeSinceLastFetch < 2000) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchExports();
        }
      }, 2000 - timeSinceLastFetch);
      
      return;
    }
    
    // Update last fetch time
    lastFetchTimeRef.current = now;
    setLoading(true);
    setError(null);
    setIsAuthError(false);

    // Create a reference to store controller and timeout
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Cleanup function to handle timeouts
    const cleanupRequest = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    try {
      // Set a timeout for the request
      timeoutId = setTimeout(() => {
        abortController.abort();
        console.log('Request timed out after 30 seconds');
        if (isMountedRef.current) {
          setLoading(false);
          setError('Request timed out. Please try again.');
        }
      }, 30000);
      
      const response = await fetchWithAuth('/api/exports', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: abortController.signal
      });
      
      // Handle response error cases
      if (!response.ok) {
        let errorMessage = 'Failed to load exports';
        
        // Authentication errors
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication error fetching exports');
          setIsAuthError(true);
          errorMessage = 'Authentication error. Please sign in again.';
        }
        
        // Try to get error details from response
        try {
          const errorData = await response.json().catch(() => ({}));
          
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
          
          // Handle token expiration
          if (errorData?.code === 'TOKEN_EXPIRED' || (errorData?.message && errorData.message.includes('expired'))) {
            console.log('Token expired in ExportList, forcing refresh...');
            
            // Force token refresh
            try {
              const currentUser = auth.currentUser;
              if (currentUser) {
                await currentUser.getIdToken(true);
                console.log('Token refreshed successfully in ExportList');
              }
            } catch (refreshError) {
              console.error('Failed to refresh token in ExportList:', refreshError);
            }
            
            setIsAuthError(true);
            setShowAuthModal(true);
          }
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
        }
        
        if (isMountedRef.current) {
          setError(errorMessage);
          setLoading(false);
        }
        
        cleanupRequest();
        return;
      }
      
      // Process successful response
      const data = await response.json();
      console.log('Exports response:', data);
      
      if (isMountedRef.current) {
        // Format the exports data to match our interface
        const formattedExports = Array.isArray(data.exports) ? data.exports.map((exp: any) => ({
          ...exp,
          // Ensure exportedAt is properly handled as a Date object
          exportedAt: exp.exportedAt ? new Date(exp.exportedAt) : new Date()
        })) : [];
        
        setExports(formattedExports);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching exports:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (isMountedRef.current) {
        setError(`Failed to load exports: ${errorMessage}`);
        setLoading(false);
        
        // Check if it's an authentication error
        if (errorMessage.includes('auth') || errorMessage.includes('token')) {
          setIsAuthError(true);
          setShowAuthModal(true);
        } else {
          toast({
            title: 'Error',
            description: `Failed to load exports: ${errorMessage}`,
            variant: 'destructive',
            duration: 5000
          });
        }
      }
    } finally {
      cleanupRequest();
    }
  }, [user, toast]);

  // Fetch exports when user is available or refresh trigger changes
  useEffect(() => {
    if (user) {
      fetchExports();
    }
  }, [user, refreshTrigger, fetchExports]);

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    // After successful sign-in, retry fetching exports
    setTimeout(() => {
      fetchExports();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48">
        <FiLoader className="animate-spin h-8 w-8 text-gray-500 mb-2" />
        <p className="text-gray-500">Loading your exports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48 text-center">
        <p className="text-red-500 mb-2">Unable to load exports</p>
        <p className="text-sm text-gray-500">{error}</p>
        
        {isAuthError ? (
          <button 
            onClick={() => setShowAuthModal(true)} 
            className="mt-4 flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <FiLogIn className="mr-1" /> Sign in again
          </button>
        ) : (
          <button 
            onClick={() => fetchExports()} 
            className="mt-4 flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <FiRefreshCw className="mr-1" /> Retry
          </button>
        )}
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48 text-center">
        <p className="text-gray-500 mb-2">No exports yet</p>
        <p className="text-sm text-gray-400">Export a pipeline to see it here</p>
      </div>
    );
  }

  return (
    <>
      <SessionExpiredModal isOpen={showAuthModal} onClose={handleCloseAuthModal} />
      <div className="overflow-y-auto max-h-[400px]">
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {exports.map((exportItem) => (
          <li 
            key={exportItem.exportId}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-150"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-1">
                <FiPackage className="h-5 w-5 text-gray-500" />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {exportItem.fileName}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(exportItem.exportId, exportItem.fileName);
                    }}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Download export"
                  >
                    <FiDownload className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {typeof exportItem.exportedAt === 'string' 
                      ? `Exported ${new Date(exportItem.exportedAt).toLocaleDateString()}`
                      : `Exported ${exportItem.exportedAt.toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
        </ul>
      </div>
    </>
  );
}
