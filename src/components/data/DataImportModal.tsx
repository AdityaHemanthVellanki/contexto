'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { FiX, FiUpload, FiFileText, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';
import SessionExpiredModal from '@/components/auth/SessionExpiredModal';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (fileId?: string) => void;
}

interface UploadedFile {
  id?: string;
  url?: string;
  progress: number;
  error?: string;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  name: string;
  size: number;
  type: string;
  lastModified: number;
  file: File;
}

export default function DataImportModal({
  isOpen,
  onClose,
  onImportSuccess
}: DataImportModalProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const preparedFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file: file,
      progress: 0,
      status: 'pending' as const
    }));
    setFiles(preparedFiles);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
    },
    maxFiles: 5,
    maxSize: 52428800, // 50MB
    onDropRejected: (rejections) => {
      const errors = rejections.map(rejection => {
        if (rejection.errors[0].code === 'file-too-large') {
          return `${rejection.file.name} is too large. Max size is 50MB.`;
        }
        if (rejection.errors[0].code === 'file-invalid-type') {
          return `${rejection.file.name} has an invalid type. Accepted types: TXT, CSV, JSON, PDF, MD.`;
        }
        return rejection.errors[0].message;
      });
      setError(errors.join('\n'));
    }
  });

  // Remove file from list
  const removeFile = (index: number) => {
    setFiles(files => files.filter((_, i) => i !== index));
  };

  // Start ingestion process for uploaded file
  const startIngestion = async (fileId: string) => {
    setIngesting(true);
    try {
      // Get the auth token
      const idToken = await user?.getIdToken(true); // Force refresh token
      if (!idToken) {
        setShowAuthModal(true);
        throw new Error('Authentication required');
      }
      
      // Always close the modal after successful upload, regardless of ingestion success
      // This prevents the UI from getting stuck if ingestion fails
      setTimeout(() => {
        onImportSuccess(fileId);
        onClose();
      }, 1500);
      
      try {
        const response = await fetch('/api/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ fileId })
        });
        
        if (!response.ok) {
          let errorMessage = 'Unknown server error';
        
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || 'Server error during ingestion';
            console.error('Ingestion API error:', errorData);
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        
          toast({
            title: 'Processing Issue',
            description: `File was uploaded but there was an issue: ${errorMessage}`,
            variant: 'default',
            duration: 5000
          });
          return;
        }
        
        await response.json(); // Parse but we don't need the result
        
        // Success
        toast({
          title: 'Data Ready',
          description: `Your data has been processed and is ready to use.`,
          variant: 'success',
          duration: 5000
        });
      } catch (ingestionErr) {
        console.error('Ingestion error:', ingestionErr);
        toast({
          title: 'Upload Successful',
          description: 'File was uploaded but processing will continue in the background.',
          variant: 'default',
          duration: 5000
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during ingestion';
      setError(errorMessage);
      toast({
        title: 'Ingestion Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIngesting(false);
    }
  };

  // Handle import submission
  const handleImport = async () => {
    if (files.length === 0) {
      setError('Please select at least one file to import.');
      return;
    }
    if (!user) {
      setError('You must be logged in to upload files.');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      // Get the auth token
      const idToken = await user.getIdToken(true); // Force refresh token
      if (!idToken) {
        setShowAuthModal(true);
        throw new Error('Authentication required');
      }

      // Update files status to uploading
      setFiles(prevFiles => 
        prevFiles.map(file => ({ ...file, status: 'uploading' as const }))
      );
      
      // For now, just upload the first file
      const file = files[0].file;
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload using binary fetch directly to R2
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/octet-stream',
          'x-filename': encodeURIComponent(file.name),
          'x-mimetype': file.type || 'application/octet-stream',
          'x-filesize': file.size.toString(),
        },
        body: file,
      });
      
      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401 || uploadResponse.status === 403) {
          setShowAuthModal(true);
          throw new Error('Your session has expired. Please sign in again.');
        }
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const responseData = await uploadResponse.json();
      const { fileId, fileUrl } = responseData;
      
      // Update this file's status
      setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        newFiles[0] = { 
          ...newFiles[0], 
          id: fileId, 
          url: fileUrl,
          progress: 100,
          status: 'complete' as const 
        };
        return newFiles;
      });
      
      setUploadProgress(100);
      
      // Update UI to show ingestion is starting
      toast({
        title: 'Upload Complete',
        description: 'Starting data processing...',
        variant: 'success',
        duration: 3000
      });
      
      // Start ingestion process
      setTimeout(() => {
        startIngestion(fileId);
      }, 1500);
      
    } catch (err) {
      setIsUploading(false);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during upload';
      setError(errorMessage);
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
      
      // Update file status to error
      setFiles(prevFiles => {
        return prevFiles.map(file => ({ 
          ...file, 
          error: errorMessage,
          status: 'error' as const 
        }));
      });
    }
  };
  
  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isUploading && e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // Handle closing of auth modal
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    if (user) {
      // Small delay to ensure token is refreshed
      setTimeout(() => {
        setError(null);
        handleImport();
      }, 500);
    }
  };

  // If modal is not open, only render the auth modal if needed
  if (!isOpen) {
    return showAuthModal ? <SessionExpiredModal isOpen={showAuthModal} onClose={handleCloseAuthModal} /> : null;
  }

  return (
    <>
      {/* Auth modal is always rendered separately to avoid key conflicts */}
      <SessionExpiredModal isOpen={showAuthModal} onClose={handleCloseAuthModal} />
      
      {/* Main modal */}
      <AnimatePresence mode="wait">
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            key="modal-content"
            ref={modalRef}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', bounce: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Import Data</h2>
              {!isUploading && (
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Close modal"
                >
                  <FiX className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Upload area */}
            {!isUploading && (
              <div
                {...getRootProps()}
                className={cn(
                  "mt-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  isDragActive
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-700"
                )}
              >
                <input {...getInputProps()} />
                <FiUpload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-gray-600 dark:text-gray-400 mb-1">Drag & drop files here, or click to select files</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Supported files: TXT, CSV, JSON, PDF, MD (Max 50MB)</p>
              </div>
            )}

            {/* Upload progress */}
            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <FiFileText className="mr-2" />
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={`file-${index}`} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[200px] text-gray-700 dark:text-gray-300">{file.name}</span>
                      <div className="ml-auto flex items-center">
                        {file.status === 'error' && (
                          <span className="text-red-500 ml-2">Error</span>
                        )}
                        {file.status === 'complete' && (
                          <FiCheckCircle className="text-green-500 ml-2" />
                        )}
                        {(file.status === 'uploading' || file.status === 'processing') && (
                          <div className="w-4 h-4 ml-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        {!isUploading && (
                          <button
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-2"
                            aria-label={`Remove ${file.name}`}
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2 rounded-md text-sm flex items-start">
                <FiAlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              {!isUploading && (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={handleImport}
                    className={cn(
                      "px-4 py-2 text-sm font-medium text-white rounded-md transition-colors",
                      files.length > 0 
                        ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700" 
                        : "bg-blue-400 cursor-not-allowed"
                    )}
                    disabled={files.length === 0 || isUploading}
                    whileHover={files.length > 0 ? { scale: 1.03 } : {}}
                    whileTap={files.length > 0 ? { scale: 0.97 } : {}}
                  >
                    Import Data
                  </motion.button>
                </>
              )}
            </div>

            {/* Success state - using a separate AnimatePresence with its own context */}
            <AnimatePresence>
              {uploadProgress === 100 && !ingesting && (
                <motion.div
                  key="upload-success-overlay"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg"
                >
                  <div className="text-center p-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                      className="mx-auto mb-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full p-3 inline-block"
                    >
                      <FiCheckCircle className="h-8 w-8" />
                    </motion.div>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">Upload Complete!</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Now analyzing your data for chat...</p>
                    <div className="animate-pulse flex justify-center">
                      <div className="h-2 w-16 bg-blue-400 rounded"></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
