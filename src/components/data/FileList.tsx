import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFile, FiLoader, FiRefreshCw, FiLogIn } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/auth-interceptor';
import { auth } from '@/utils/firebase';
import SessionExpiredModal from '@/components/auth/SessionExpiredModal';

interface FileItem {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  status: string;
}

interface FileListProps {
  onSelectFile: (fileId: string) => void;
  activeFileId?: string;
  refreshTrigger?: number;
}

export default function FileList({ onSelectFile, activeFileId, refreshTrigger = 0 }: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
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
  const fetchFiles = useCallback(async (isRetry = false, currentRetryCount = 0) => {
    console.log('Fetching files, isRetry:', isRetry, 'retryCount:', currentRetryCount);
    
    if (!user) {
      console.warn('No user found, showing auth modal');
      setIsAuthError(true);
      setError('Authentication required. Please sign in.');
      setShowAuthModal(true);
      return;
    }
    
    // Force refresh token before fetching files to prevent auth issues
    if (!isRetry && auth.currentUser) {
      try {
        // Force token refresh and save to sessionStorage for API calls
        const freshToken = await auth.currentUser.getIdToken(true);
        sessionStorage.setItem('authToken', freshToken);
        console.log('Token refreshed before fetching file list');
      } catch (tokenError) {
        console.error('Token refresh failed:', tokenError);
        
        // Check if the error is auth-related
        let tokenErrorMessage = 'Unknown error';
        if (tokenError instanceof Error) {
          tokenErrorMessage = tokenError.message;
        }
        
        if (tokenErrorMessage.includes('auth') || 
            tokenErrorMessage.includes('token') || 
            tokenErrorMessage.includes('credential')) {
          setIsAuthError(true);
          setError('Your session has expired. Please sign in again.');
          setShowAuthModal(true);
          return;
        }
        
        // Continue with potentially cached token if not auth-related
      }
    }
    
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
          fetchFiles();
        }
      }, 2000 - timeSinceLastFetch);
      
      return;
    }
    
    // Update last fetch time
    lastFetchTimeRef.current = now;
    
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }

    try {
      // Use our authenticated fetch utility with automatic token refresh
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;
      
      const cleanupRequest = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      // Define a variable to track if this is an auth error
      let isAuthRelatedError = false;
      
      try {
        // Set timeout to abort if request takes too long
        timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            console.log('Request timeout reached, aborting');
            abortController.abort();
          }
        }, 15000);

        const response = await fetchWithAuth('/api/uploads', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: abortController.signal
        });
        
        // Check for non-OK responses
        if (!response.ok) {
          // Extract error details from response
          let errorData = { message: 'Unknown error', code: '' };
          try {
            errorData = await response.json();
          } catch (e) {
            console.warn('Failed to parse error response:', e);
            // Fallback error message if JSON parsing fails
            errorData = { 
              message: response.statusText || 'Server error occurred', 
              code: 'PARSE_ERROR' 
            };
          }
          
          // Ensure we have proper error information
          const errorMessage = errorData.message || 'Failed to load files';
          const errorCode = errorData.code || '';
          const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            message: errorMessage,
            code: errorCode,
            url: '/api/uploads'
          };
          console.error('File list error details:', errorDetails);
          
          // Handle authentication errors
          if (response.status === 401 || response.status === 403 || 
              errorMessage.toLowerCase().includes('session') ||
              errorMessage.toLowerCase().includes('auth') ||
              errorMessage.toLowerCase().includes('token') ||
              ['SESSION_EXPIRED', 'AUTH_ERROR', 'AUTH_REQUIRED', 'TOKEN_EXPIRED', 'TOKEN_REVOKED']
                .includes(errorCode)) {
            
            console.warn('Authentication error in FileList:', errorCode || response.status);
            setIsAuthError(true);
            isAuthRelatedError = true;
            setError('Authentication error. Session expired.');
            setShowAuthModal(true);
            
            // Clear stored token when auth error detected
            sessionStorage.removeItem('authToken');
            
            // We'll use the AuthContext's user object and sign-in methods instead
            // of direct Firebase auth access since that's more consistent with
            // the application's authentication architecture
            try {
              // Just mark that we should sign in again
              console.log('Authentication token needs refresh - will prompt for sign in');
            } catch (refreshError) {
              console.error('Error handling auth refresh:', refreshError);
            }
            throw new Error('Authentication error. Session expired.');
          }
          
          // Handle rate limiting specially
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
            throw new Error(`Rate limited. Retrying in ${retryAfter} seconds.`);
          }
          
          // Handle other API errors
          throw new Error(`Error loading files: ${errorMessage}`);
        }
        
        // Process successful response
        const responseData = await response.json();
        const fileUploads = responseData.uploads || [];
        
        // Sort files by uploadedAt date (newest first)
        const processedFiles = fileUploads.map((file: any) => ({
          ...file,
          uploadedAt: new Date(file.uploadedAt || Date.now())
        })).sort((a: FileItem, b: FileItem) => 
          b.uploadedAt.getTime() - a.uploadedAt.getTime()
        );
        
        if (isMountedRef.current) {
          // Reset auth error state on successful fetch
          setIsAuthError(false);
          
          // Reset retry count on success
          if (retryCount > 0) {
            setRetryCount(0);
          }
          
          setFiles(processedFiles);
          setError(null);
        }
      } catch (err) {
        // Improved error handling with more detailed logging
        let errorMessage = 'Unknown error occurred';
        let errorDetails: Record<string, any> = {};
        
        // Force debug log of the raw error object
        console.log('Raw error object in FileList:', err);
        
        if (err instanceof Error) {
          errorMessage = err.message;
          errorDetails = {
            name: err.name,
            message: err.message,
            stack: err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace'
          };
          
          // Extract any additional properties from the error
          Object.getOwnPropertyNames(err).forEach(key => {
            if (key !== 'name' && key !== 'message' && key !== 'stack') {
              try {
                // @ts-ignore: Dynamic property access
                errorDetails[key] = JSON.stringify(err[key]);
              } catch (e) {
                // @ts-ignore: Dynamic property access
                errorDetails[key] = '[Non-serializable value]';
              }
            }
          });
        } else if (err !== null && typeof err === 'object') {
          try {
            errorMessage = JSON.stringify(err);
            // Convert each property to ensure serializability
            Object.entries(err).forEach(([key, value]) => {
              try {
                errorDetails[key] = typeof value === 'object' ? JSON.stringify(value) : value;
              } catch (e) {
                errorDetails[key] = '[Non-serializable value]';
              }
            });
          } catch (e) {
            errorMessage = 'Complex error object that cannot be stringified';
            errorDetails.stringifyError = String(e);
          }
        } else if (err === null) {
          errorMessage = 'Null error received';
          errorDetails.isNull = true;
        } else if (err === undefined) {
          errorMessage = 'Undefined error received';
          errorDetails.isUndefined = true;
        } else {
          errorMessage = String(err);
          errorDetails.primitiveValue = String(err);
          errorDetails.valueType = typeof err;
        }
        
        // Ensure error details is never empty
        if (Object.keys(errorDetails).length === 0) {
          errorDetails.fallback = 'No extractable details';
          errorDetails.timestamp = new Date().toISOString();
        }
        
        console.error('Error fetching files:', errorMessage, errorDetails);
        
        // Only show errors for non-retry attempts to avoid spamming
        if (!isRetry && isMountedRef.current) {
          // Check for authentication-related errors in the error message
          const authKeywords = ['authentication', 'unauthorized', 'forbidden', 'session expired', 
                               'token expired', 'login required', 'token revoked'];
          
          // Check if this is an auth-related error based on keywords
          const hasAuthKeyword = authKeywords.some(keyword => 
            errorMessage.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (hasAuthKeyword) {
            console.log('Authentication error detected in message:', errorMessage);
            setIsAuthError(true);
            isAuthRelatedError = true;
            setError('Your session has expired. Please sign in again.');
            setShowAuthModal(true);
          } else {
            // For non-auth errors, show regular error and toast
            setError(errorMessage);
            
            // Don't show toast for rate limiting, just retry
            if (!errorMessage.includes('Rate limited')) {
              toast({
                title: 'Error Loading Files',
                description: errorMessage.length > 100 ? 
                  `${errorMessage.substring(0, 100)}...` : errorMessage,
                variant: 'destructive'
              });
            }
          }
        }
        
        // Implement exponential backoff for retries, but don't retry auth errors
        if (currentRetryCount < 5 && isMountedRef.current && !isAuthRelatedError) {
          const nextRetryCount = currentRetryCount + 1;
          const retryDelay = Math.min(1000 * Math.pow(1.5, nextRetryCount), 10000);
          
          setRetryCount(nextRetryCount);
          
          console.log(`Retrying fetch (${nextRetryCount}/5) in ${retryDelay}ms`);
          
          fetchTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchFiles(true, nextRetryCount);
            }
          }, retryDelay);
        }
      } finally {
        cleanupRequest();
      }
    } finally {
      if (isMountedRef.current && !isRetry) {
        setLoading(false);
      }
    }
  }, [user, retryCount, toast]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchFiles(false, 0);
  }, [fetchFiles, refreshTrigger]);

  const handleSelectFile = (fileId: string) => {
    onSelectFile(fileId);
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    // After successful sign-in, retry fetching files
    setTimeout(() => {
      fetchFiles(false, 0);
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48">
        <FiLoader className="animate-spin h-8 w-8 text-gray-500 mb-2" />
        <p className="text-gray-500">Loading your files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48 text-center">
        <p className="text-red-500 mb-2">Unable to load files</p>
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
            onClick={() => fetchFiles(false, 0)} 
            className="mt-4 flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <FiRefreshCw className="mr-1" /> Retry
          </button>
        )}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-48 text-center">
        <p className="text-gray-500 mb-2">No files uploaded yet</p>
        <p className="text-sm text-gray-400">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <>
      <SessionExpiredModal isOpen={showAuthModal} onClose={handleCloseAuthModal} />
      <div className="overflow-y-auto max-h-[400px]">
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {files.map((file) => (
          <li 
            key={file.fileId}
            onClick={() => handleSelectFile(file.fileId)}
            className={`p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition duration-150 ${
              activeFileId === file.fileId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-1">
                <FiFile className={`h-5 w-5 ${
                  activeFileId === file.fileId ? 'text-blue-500' : 'text-gray-500'
                }`} />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${
                    activeFileId === file.fileId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-500">
                    {file.fileType.split('/')[1]?.toUpperCase() || file.fileType} · {file.status || 'Ready'}
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
