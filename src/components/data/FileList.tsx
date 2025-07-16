import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFile, FiLoader, FiRefreshCw, FiLogIn, FiTrash2, FiMessageSquare } from 'react-icons/fi';
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
  onFilesLoaded?: (hasFiles: boolean) => void;
  selectionMode?: 'default' | 'mcp';
  onSelectForMCP?: (fileId: string) => void;
}

export default function FileList({ 
  onSelectFile, 
  activeFileId, 
  refreshTrigger = 0, 
  onFilesLoaded,
  selectionMode = 'default',
  onSelectForMCP
}: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Function to clean up any pending requests
  const cleanupRequest = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
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
    
    // Only show loading indicator for initial fetch, not retries
    if (!isRetry && isMountedRef.current) {
      setLoading(true);
    }
    
    try {
      const response = await fetchWithAuth('/api/uploads');
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch files';
        
        // Check for auth-related errors
        const isAuthRelatedError = response.status === 401 || 
                                  response.status === 403 || 
                                  (response.headers.get('WWW-Authenticate') !== null);
        
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (jsonError) {
          // If we can't parse the JSON, just use the status text
          errorMessage = response.statusText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (isMountedRef.current) {
        // Process the files data - handle different response structures
        // Check if data.files exists, otherwise look for data.uploads or use data directly
        const fileArray = data.files || data.uploads || (Array.isArray(data) ? data : []);
        
        if (!fileArray || !Array.isArray(fileArray)) {
          console.warn('Unexpected API response format:', data);
          setFiles([]);
          setError('Unexpected response format from server');
          return;
        }
        
        const processedFiles = fileArray.map((file: any) => ({
          ...file,
          uploadedAt: new Date(file.uploadedAt || Date.now())
        }));
        
        // Sort files by upload date, newest first
        processedFiles.sort((a: FileItem, b: FileItem) => 
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
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Error fetching files:', error);
        
        let errorMessage = 'Failed to load files';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        // Check if this is an auth-related error
        const isAuthRelatedError = errorMessage.toLowerCase().includes('auth') || 
                                  errorMessage.toLowerCase().includes('token') || 
                                  errorMessage.toLowerCase().includes('sign in') ||
                                  errorMessage.toLowerCase().includes('unauthorized') ||
                                  errorMessage.toLowerCase().includes('forbidden');
        
        if (isAuthRelatedError) {
          setIsAuthError(true);
          setError('Authentication required. Please sign in again.');
          setShowAuthModal(true);
        } else {
          setError(errorMessage);
          
          // Only show toast for non-retry attempts
          if (!isRetry) {
            toast({
              title: 'Error loading files',
              description: errorMessage.length > 100 ? 
                `${errorMessage.substring(0, 100)}...` : errorMessage,
              variant: 'destructive'
            });
          }
        }
        
        // Implement exponential backoff for retries, but don't retry auth errors
        if (currentRetryCount < 5 && isMountedRef.current && !isAuthRelatedError) {
          const nextRetryCount = currentRetryCount + 1;
          const backoffTime = Math.min(1000 * Math.pow(2, nextRetryCount), 30000);
          
          setRetryCount(nextRetryCount);
          
          console.log(`Retry ${nextRetryCount} scheduled in ${backoffTime}ms`);
          fetchTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchFiles(true, nextRetryCount);
            }
          }, backoffTime);
        }
      }
    } finally {
      cleanupRequest();
      if (isMountedRef.current && !isRetry) {
        setLoading(false);
      }
    }
  }, [user, retryCount, toast, cleanupRequest]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchFiles(false, 0);
  }, [fetchFiles, refreshTrigger]);
  
  // Notify parent component about file status whenever files change
  useEffect(() => {
    if (!loading && onFilesLoaded) {
      onFilesLoaded(files.length > 0);
    }
  }, [files, loading, onFilesLoaded]);

  // Auto-select first file when files are loaded and no file is selected
  useEffect(() => {
    // If we have files but no activeFileId, select the first file
    if (files.length > 0 && !activeFileId) {
      onSelectFile(files[0].fileId);
    }
  }, [files, activeFileId, onSelectFile]);

  const handleSelectFile = (fileId: string) => {
    onSelectFile(fileId);
  };

  const handleSelectForMCP = (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onSelectForMCP) {
      onSelectForMCP(fileId);
    }
  };

  const handleDeleteClick = (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingFileId(fileId);
  };

  const confirmDeleteFile = async () => {
    if (!deletingFileId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/file/${deletingFileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete file');
      }
      
      // Remove the file from the local state
      setFiles(files.filter(file => file.fileId !== deletingFileId));
      
      // Show success message
      toast({
        title: 'File deleted',
        description: 'The file has been successfully deleted',
        variant: 'default'
      });
      
      // If the deleted file was the active file, select another file if available
      if (deletingFileId === activeFileId && files.length > 1) {
        const nextFile = files.find(file => file.fileId !== deletingFileId);
        if (nextFile) {
          onSelectFile(nextFile.fileId);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
      setDeletingFileId(null);
    }
  };

  const cancelDeleteFile = () => {
    setDeletingFileId(null);
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
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                    
                    {selectionMode === 'mcp' && onSelectForMCP && (
                      <button
                        onClick={(e) => handleSelectForMCP(file.fileId, e)}
                        className="p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        title="Select for MCP discussion"
                      >
                        <FiMessageSquare className="h-4 w-4 text-blue-600" />
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => handleDeleteClick(file.fileId, e)}
                      className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                      title="Delete file"
                    >
                      <FiTrash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
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
      
      {/* Delete confirmation dialog */}
      {deletingFileId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Confirm Deletion</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this file? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteFile}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFile}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <FiLoader className="animate-spin h-4 w-4 mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}