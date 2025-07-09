import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFile, FiLoader, FiRefreshCw, FiLogIn } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/auth-interceptor';
import { auth } from '@/utils/firebase';

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
  const fetchFiles = useCallback(async (isRetry = false, retryCount = 0) => {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetchWithAuth('/api/uploads', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // If response is 401/403, it's an auth issue
        if (response.status === 401 || response.status === 403) {
          // Try to get error details from response
          const errorData = await response.json().catch(() => ({}));
          console.log('Auth error details:', errorData);
          
          // If token expired, try refreshing token and retry once
          if (errorData?.code === 'TOKEN_EXPIRED' || errorData?.message?.includes('expired')) {
            if (retryCount < 2) {
              console.log('Token expired, forcing refresh and retrying...');
              
              // Force token refresh
              try {
                const user = auth.currentUser;
                if (user) {
                  await user.getIdToken(true);
                  console.log('Token refreshed successfully, retrying fetch');
                  
                  // Wait a moment then retry
                  setTimeout(() => {
                    fetchFiles(true, retryCount + 1);
                  }, 1000);
                  return;
                }
              } catch (refreshError) {
                console.error('Failed to refresh token after expiry:', refreshError);
              }
            }
          }
          
          // If we got here, we couldn't refresh the token or retries failed
          setIsAuthError(true);
          throw new Error('Authentication error. Please reload the page or sign in again.');
        }
        
        // If rate limited (429), implement exponential backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          throw new Error(`Rate limited. Retrying in ${retryAfter} seconds.`);
        }
        
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Reset retry count on success
      if (retryCount > 0) {
        setRetryCount(0);
      }
      
      // Sort files by uploadedAt date (newest first)
      const sortedFiles = data.uploads.map((file: any) => ({
        ...file,
        uploadedAt: new Date(file.uploadedAt)
      })).sort((a: FileItem, b: FileItem) => 
        b.uploadedAt.getTime() - a.uploadedAt.getTime()
      );
      
      if (isMountedRef.current) {
        setFiles(sortedFiles);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
      
      // Only show toast for non-retry attempts to avoid spamming
      if (!isRetry && isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load files');
        
        // Don't show toast for rate limiting, just retry
        if (!(err instanceof Error && err.message?.includes('Rate limited'))) {
          toast({
            title: 'Error Loading Files',
            description: err instanceof Error ? err.message : 'Failed to load files',
            variant: 'destructive',
            duration: 5000
          });
        }
      }
      
      // Implement exponential backoff for retries
      if (isMountedRef.current && retryCount < 5) { // Max 5 retries
        const nextRetryCount = retryCount + 1;
        setRetryCount(nextRetryCount);
        
        // Exponential backoff: 2^retry * 1000ms (1s, 2s, 4s, 8s, 16s)
        const retryDelay = Math.min(Math.pow(2, nextRetryCount) * 1000, 30000);
        
        console.log(`Retrying in ${retryDelay/1000}s (attempt ${nextRetryCount}/5)`);
        
        fetchTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchFiles(true); // Retry with flag
          }
        }, retryDelay);
      }
    } finally {
      if (isMountedRef.current && !isRetry) {
        setLoading(false);
      }
    }
  }, [user, retryCount, toast]);

  // Trigger fetch when dependencies change
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshTrigger]);

  const handleSelectFile = (fileId: string) => {
    onSelectFile(fileId);
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
            onClick={() => router.push('/auth/signin')} 
            className="mt-4 flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <FiLogIn className="mr-1" /> Sign in again
          </button>
        ) : (
          <button 
            onClick={() => fetchFiles()} 
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
  );
}
