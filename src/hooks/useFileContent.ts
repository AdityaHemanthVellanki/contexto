import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

interface FileContent {
  fileId: string;
  fileName: string;
  fileType: string;
  fileContent: string;
  uploadedAt: Date;
  fileSize: number;
  status: string;
}

/**
 * Hook for fetching file content from Firestore
 * Used when a file is selected in the FileList component
 */
export function useFileContent(fileId: string | null) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchFileContent = async () => {
      // Reset state when fileId changes
      setContent(null);
      setError(null);
      
      // Only fetch if we have a fileId and authenticated user
      if (!fileId || !user) return;
      
      try {
        setLoading(true);
        
        // Get the user's auth token
        const token = await user.getIdToken();
        
        // Fetch the file content from the API
        const response = await fetch(`/api/file/${fileId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          // Handle authentication errors
          if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication error. Please sign in again.');
          }
          
          // Handle file not found
          if (response.status === 404) {
            throw new Error('File not found. It may have been deleted.');
          }
          
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Set content with file data including content field
        setContent({
          ...data,
          uploadedAt: new Date(data.uploadedAt)
        });
      } catch (err) {
        console.error('Error fetching file content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file content');
        
        toast({
          title: 'Error Loading File',
          description: err instanceof Error ? err.message : 'Failed to load file content',
          variant: 'destructive',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFileContent();
  }, [fileId, user, toast]);

  return { content, loading, error };
}
