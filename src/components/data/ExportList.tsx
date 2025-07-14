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
  exportContent: string; // Base64 encoded or JSON string content
  contentType: string; // 'application/json' or 'application/zip'
  fileSize: number;
  exportedAt: Date;
}

interface ExportListProps {
  refreshTrigger?: number;
}

export default function ExportList({ refreshTrigger = 0 }: ExportListProps) {
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
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

  // Debounced fetch function with exponential backoff for retries
  const fetchExports = useCallback(async (isRetry = false, currentRetryCount = 0) => {
    if (!user) return;
    
    // Rate limiting protection
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // If not a retry and it's been less than 2 seconds since last fetch, debounce
    if (!isRetry && timeSinceLastFetch < 2000) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Schedule a fetch after the debounce period
      fetchTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchExports(false, 0);
        }
      }, 2000 - timeSinceLastFetch);
      
      return;
    }
    
    // Update last fetch time
    lastFetchTimeRef.current = now;
    
    if (!isRetry) {
      setLoading(true);
      setError(null);
      setIsAuthError(false);
    }

    // Create a reference to store controller and timeout
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Create a cleanup function to ensure both timeout and controller are properly handled
    const cleanupRequest = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    try {
      // Set a timeout for the request
      toast({
        title: 'Starting Download',
        description: 'Preparing your export...',
        variant: 'default',
        duration: 3000
      });
      
      timeoutId = setTimeout(() => {
        if (abortController) {
          abortController.abort();
          console.log('Request timed out after 45 seconds');
        }
      }, 45000); // 45 second timeout for larger R2 files
      
      const response = await fetchWithAuth('/api/exports', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: abortController.signal
      });
      
      if (!response.ok) {
        // If response is 401/403, it's an auth issue
        if (response.status === 401 || response.status === 403) {
          // Try to get error details from response
          const errorData = await response.json().catch(() => ({}));
          console.log('Auth error details in ExportList:', errorData);
          
          // If token expired, try refreshing token and retry once
          if (errorData?.code === 'TOKEN_EXPIRED' || errorData?.message?.includes('expired')) {
            if (currentRetryCount < 2) {
              console.log('Token expired in ExportList, forcing refresh and retrying...');
              
              // Force token refresh
              try {
                const user = auth.currentUser;
                if (user) {
                  await user.getIdToken(true);
                  console.log('Token refreshed successfully in ExportList, retrying fetch');
                  
                  // Wait a moment then retry
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      fetchExports(true, currentRetryCount + 1);
                    }
                  }, 1000);
                  cleanupRequest(); // Clean up before returning
                  return;
                }
              } catch (refreshError) {
                console.error('Error refreshing token:', refreshError);
              }
            }
          }
          
          // Set auth error state for UI feedback and show modal
          if (isMountedRef.current) {
            setIsAuthError(true);
            setError('Your session has expired. Please sign in again.');
            setShowAuthModal(true);
          }
          throw new Error('Authentication error. Session expired.');
        }
        
        // If rate limited (429), implement exponential backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          throw new Error(`Rate limited. Retrying in ${retryAfter} seconds.`);
        }
        
        throw new Error(`Failed to fetch exports: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Sort exports by date, most recent first
      const sortedExports = data.exports.map((exportItem: any) => ({
        ...exportItem,
        exportedAt: new Date(exportItem.exportedAt)
      })).sort((a: ExportItem, b: ExportItem) => 
        b.exportedAt.getTime() - a.exportedAt.getTime()
      );
      
      // Handle fetch success
      if (isMountedRef.current) {
        setExports(Array.isArray(sortedExports) ? sortedExports : []);
        setError(null);
        setRetryCount(0); // Reset retry count on success
      }
      
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Error fetching exports:', error);
      
      // Handle AbortError specifically
      if (error instanceof DOMException && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        // Provide better error message for the user
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
      }
      
      // Cancel any pending retries
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      
      // Only show toast for non-retry attempts to avoid spamming
      if (!isRetry && isMountedRef.current) {
        toast({
          title: 'Error Loading Exports',
          description: error instanceof Error ? error.message : 'Failed to load exports',
          variant: 'destructive',
          duration: 5000
        });
      }
      
      // Retry with exponential backoff
      if (isMountedRef.current && currentRetryCount < 5) { // Max 5 retries
        const nextRetryCount = currentRetryCount + 1;
        setRetryCount(nextRetryCount);
        
        // Exponential backoff: 2^retry * 1000ms (1s, 2s, 4s, 8s, 16s)
        const retryDelay = Math.min(Math.pow(2, nextRetryCount) * 1000, 30000);
        
        console.log(`Retrying in ${retryDelay/1000}s (attempt ${nextRetryCount}/5)`);
        
        fetchTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchExports(true, nextRetryCount);
          }
        }, retryDelay);
      }
      
    } finally {
      cleanupRequest();
      if (isMountedRef.current && !isRetry) {
        setLoading(false);
      }
    }
  }, [user, retryCount, toast, isMountedRef]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchExports(false, 0);
  }, [fetchExports, refreshTrigger]);

  const handleDownload = async (exportId: string, fileName: string) => {
    // Create controller and timeout variables outside try block so they can be cleaned up in finally
    let controller: AbortController | null = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to download exports',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }
      
      // Force refresh token before download to prevent auth issues
      if (auth.currentUser) {
        try {
          // Always refresh token before downloads as they're less frequent operations
          const token = await auth.currentUser.getIdToken(true);
          sessionStorage.setItem('authToken', token);
          console.log('Token refreshed successfully before download');
        } catch (tokenError) {
          console.warn('Token refresh failed:', tokenError);
          // Continue with potentially cached token
        }
      }
      
      // Show downloading toast
      toast({
        title: 'Starting Download',
        description: 'Preparing your export...',
        variant: 'default',
        duration: 3000
      });
      
      timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
          console.log('Download request timed out after 45 seconds');
        }
      }, 45000); // 45 second timeout for larger R2 files
      
      const response = await fetchWithAuth(`/api/export/${exportId}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401 || response.status === 403) {
          if (isMountedRef.current) {
            setIsAuthError(true);
            setError('Your session has expired. Please sign in again.');
            setShowAuthModal(true); // Show modal instead of just error message
          }
          throw new Error('Authentication error. Session expired.');
        }
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          throw new Error(`Rate limited. Please try again in ${retryAfter} seconds.`);
        }
        
        throw new Error(`Failed to fetch export: ${response.statusText}`);
      }

      const exportData = await response.json();
      
      // Process export content based on format and storage location
      let dataBlob: Blob;
      
      // Check if the export was stored using R2 (new system)
      if (exportData.fromR2) {
        console.log('Processing R2-stored export');
        // For R2-stored files, the exportContent will be base64 from the API
        const contentType = exportData.contentType || 'application/octet-stream';
        
        // Convert base64 to blob
        const byteCharacters = window.atob(exportData.exportContent);
        const byteArrays = [];
        for (let i = 0; i < byteCharacters.length; i += 1024) {
          const slice = byteCharacters.slice(i, i + 1024);
          const byteNumbers = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) {
            byteNumbers[j] = slice.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        dataBlob = new Blob(byteArrays, { type: contentType });
      } else if (exportData.exportContent.startsWith('data:')) {
        // Legacy: It's already a data URL (from old Firebase storage)
        const parts = exportData.exportContent.split(',');
        if (parts.length === 2) {
          const base64Data = parts[1];
          const contentType = parts[0].split(':')[1].split(';')[0];
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          dataBlob = new Blob([bytes], { type: contentType });
        } else {
          throw new Error('Invalid data URL format');
        }
      } else {
        // Legacy: It's base64, convert to blob
        const contentType = exportData.contentType || 'application/octet-stream';
        
        // Convert base64 to blob
        const byteCharacters = window.atob(exportData.exportContent);
        const byteArrays = [];
        for (let i = 0; i < byteCharacters.length; i += 1024) {
          const slice = byteCharacters.slice(i, i + 1024);
          const byteNumbers = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) {
            byteNumbers[j] = slice.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        dataBlob = new Blob(byteArrays, { type: contentType });
      }
      
      // Create a temporary link to download the file
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (isMountedRef.current) {
        toast({
          title: 'Download Started',
          description: 'Your export is being downloaded',
          variant: 'success',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      
      // Only show error toast if still mounted
      if (isMountedRef.current) {
        // Different message for specific error types
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast({
            title: 'Download Timeout',
            description: 'The download took too long and was cancelled. Please try again.',
            variant: 'destructive',
            duration: 5000
          });
        } else if (error instanceof Response || (error as any)?.status === 401 || 
                 (error instanceof Error && error.message.includes('auth'))) {
          toast({
            title: 'Authentication Error',
            description: 'Your session has expired. Please sign in again.',
            variant: 'destructive',
            duration: 5000
          });
          // Force refresh token on auth error
          if (auth.currentUser) {
            try {
              await auth.currentUser.getIdToken(true);
            } catch (refreshError) {
              console.error('Failed to refresh token after auth error:', refreshError);
            }
          }
        } else if ((error as any)?.status === 429 || 
                   (error instanceof Error && error.message.includes('too many requests'))) {
          toast({
            title: 'Too Many Requests',
            description: 'Please wait a moment before downloading again.',
            variant: 'destructive',
            duration: 5000
          });
        } else {
          toast({
            title: 'Download Failed',
            description: error instanceof Error ? error.message : 'Failed to download export',
            variant: 'destructive',
            duration: 5000
          });
        }
      }
    } finally {
      // Clean up resources
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      controller = null;
    }
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
            onClick={() => fetchExports(false, 0)} 
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

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    // After successful sign-in, retry fetching exports
    setTimeout(() => {
      fetchExports(false, 0);
    }, 500);
  };

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
                    Exported {new Date(exportItem.exportedAt).toLocaleDateString()}
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
