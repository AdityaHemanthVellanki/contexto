import { useEffect, useState, useRef, useCallback } from 'react';
import { FiDownload, FiPackage, FiLoader, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

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
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  
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
  const fetchExports = useCallback(async (isRetry = false) => {
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
          fetchExports();
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
      // Get the user's auth token
      const token = await user.getIdToken();
      
      // Fetch the exports from the API with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/exports', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // If response is 401/403, it's an auth issue
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error. Please sign in again.');
        }
        
        // If rate limited (429), implement exponential backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          throw new Error(`Rate limited. Retrying in ${retryAfter} seconds.`);
        }
        
        throw new Error(`Failed to fetch exports: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Reset retry count on success
      if (retryCount > 0) {
        setRetryCount(0);
      }
      
      // Sort exports by exportedAt date (newest first)
      const sortedExports = data.exports.map((exportItem: any) => ({
        ...exportItem,
        exportedAt: new Date(exportItem.exportedAt)
      })).sort((a: ExportItem, b: ExportItem) => 
        b.exportedAt.getTime() - a.exportedAt.getTime()
      );
      
      if (isMountedRef.current) {
        setExports(sortedExports);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching exports:', err);
      
      // Only show toast for non-retry attempts to avoid spamming
      if (!isRetry && isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load exports');
        
        // Don't show toast for rate limiting, just retry
        if (!(err instanceof Error && err.message?.includes('Rate limited'))) {
          toast({
            title: 'Error Loading Exports',
            description: err instanceof Error ? err.message : 'Failed to load exports',
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
            fetchExports(true); // Retry with flag
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
    fetchExports();
  }, [fetchExports, refreshTrigger]);

  const handleDownload = async (exportId: string, fileName: string) => {
    if (!user) return;
    
    try {
      // Get the user's auth token
      const token = await user.getIdToken();
      
      // Fetch the export content from the API with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for downloads
      
      const response = await fetch(`/api/export/${exportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch export: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Create a data URL from the Base64 content
      const contentType = data.contentType || 'application/octet-stream';
      const blob = data.exportContent.startsWith('data:') 
        ? await fetch(data.exportContent).then(r => r.blob())
        : new Blob([Buffer.from(data.exportContent, 'base64')], { type: contentType });
      
      // Create a temporary link to download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
      title: 'Download Started',
      description: 'Your export is being downloaded',
      variant: 'success',
      duration: 3000
    });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download export',
        variant: 'destructive',
        duration: 5000
      });
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
        <button 
          onClick={() => fetchExports()} 
          className="mt-4 flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          <FiRefreshCw className="mr-1" /> Retry
        </button>
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
  );
}
