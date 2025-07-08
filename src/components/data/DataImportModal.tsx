'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { FiX, FiUpload, FiFileText, FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/AuthContext';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Authentication required');
      
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ fileId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to ingest data');
      }
      
      const result = await response.json();
      
      // Success
      onImportSuccess(fileId);
      onClose();
      toast({
        title: 'Data Ready',
        description: `Your data has been processed and is ready to use.`,
        variant: 'success',
        duration: 5000
      });
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
    
    // Track the progress for all files
    let completedFiles = 0;
    let successfulFileId: string | null = null;

    try {
      // Update files status to uploading
      setFiles(prevFiles => 
        prevFiles.map(file => ({ ...file, status: 'uploading' as const }))
      );
      
      // Upload each file individually - we'll only use the first file for now
      if (files.length > 0) {
        const currentFile = files[0];
        
        // Get the auth token
        const idToken = await user.getIdToken();
        
        // Prepare form data for our API route
        const formData = new FormData();
        formData.append('file', currentFile.file);
        
        // Upload the file using our API route
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          body: formData
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.message || `Failed to upload ${currentFile.name}`);
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
        
        completedFiles++;
        setUploadProgress(100);
        
        // Store the ID of the successful file
        successfulFileId = fileId;
        
        // Update UI to show ingestion is starting
        toast({
          title: 'Upload Complete',
          description: 'Preparing your data for analysis...',
          variant: 'success',
          duration: 3000
        });
        
        // Start ingestion process
        await startIngestion(fileId);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setUploadProgress(0);
      setIsUploading(false);
      
      // Show error toast
      toast({
        title: 'Import Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      if (!isUploading) onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
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

          {/* Drop zone */}
          {!isUploading && (
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed p-8 rounded-lg text-center cursor-pointer transition-colors",
                isDragActive 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600",
                files.length > 0 && "border-green-500 dark:border-green-600"
              )}
            >
              <input {...getInputProps()} />
              <FiUpload className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" />
              
              {isDragActive ? (
                <p className="text-blue-600 dark:text-blue-400">Drop the files here...</p>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  Drag &amp; drop files here, or click to select files
                </p>
              )}
              
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Supports PDF, TXT, CSV, JSON, MD (Max 10MB per file)
              </p>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && !isUploading && (
            <div className="mt-4 max-h-40 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {files.length} {files.length === 1 ? 'file' : 'files'} selected:
              </h3>
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-sm">
                    <div className="flex items-center overflow-hidden">
                      <FiFileText className="h-4 w-4 text-blue-500 flex-shrink-0 mr-2" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-2"
                      aria-label={`Remove ${file.name}`}
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="py-6">
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
              </div>
              <div className="text-center mb-4">
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {ingesting ? 'Analyzing your data...' : 'Uploading files...'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ingesting 
                    ? 'Building your semantic index' 
                    : 'Please don\'t close this window'}
                </p>
              </div>
              <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-right mt-1 text-xs text-gray-500 dark:text-gray-400">{Math.round(uploadProgress)}%</p>
              
              {/* Show individual file progress */}
              <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center text-sm">
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
              {error}
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

          {/* Success state */}
          <AnimatePresence>
            {uploadProgress === 100 && !ingesting && (
              <motion.div
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
  );
}
