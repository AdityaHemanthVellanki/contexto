'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiFile, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

interface FileUploadStepProps {
  onComplete: (fileIds: string[], fileNames: string[], description: string) => void;
  initialFileIds?: string[];
  initialFileNames?: string[];
  initialDescription?: string;
}

interface UploadedFile {
  id?: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  file: File;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png']
};

export default function FileUploadStep({ 
  onComplete, 
  initialFileIds = [], 
  initialFileNames = [],
  initialDescription = '' 
}: FileUploadStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [description, setDescription] = useState(initialDescription);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>(initialFileIds);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>(initialFileNames);

  // Initialize with any existing files
  useEffect(() => {
    if (initialFileIds.length > 0 && initialFileNames.length > 0) {
      setUploadedFileIds(initialFileIds);
      setUploadedFileNames(initialFileNames);
    }
  }, [initialFileIds, initialFileNames]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending' as const,
      file
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: 50 * 1024 * 1024, // 50MB max file size
    multiple: true
  });

  const uploadFiles = async () => {
    if (!user || files.length === 0) return;
    
    setIsUploading(true);
    const token = await user.getIdToken();
    const newFileIds: string[] = [];
    const newFileNames: string[] = [];
    let hasError = false;

    // Process each file sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.status === 'complete') continue;
      
      try {
        // Update status to uploading
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading', progress: 0 } : f
        ));
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file.file);
        
        // Upload file
        const uploadResponse = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        const uploadData = await uploadResponse.json();
        
        // Confirm upload
        const confirmResponse = await fetch('/api/uploads/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileId: uploadData.fileId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          })
        });
        
        if (!confirmResponse.ok) {
          throw new Error(`Failed to confirm upload: ${confirmResponse.statusText}`);
        }
        
        const confirmData = await confirmResponse.json();
        
        // Update file status
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'complete', 
            progress: 100,
            id: uploadData.fileId
          } : f
        ));
        
        // Add to uploaded files list
        newFileIds.push(uploadData.fileId);
        newFileNames.push(file.name);
        
      } catch (error) {
        console.error('File upload error:', error);
        
        // Update file status to error
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ));
        
        hasError = true;
        
        toast({
          title: 'Upload Error',
          description: error instanceof Error ? error.message : 'Failed to upload file',
          variant: 'destructive'
        });
      }
    }
    
    setIsUploading(false);
    
    if (newFileIds.length > 0) {
      setUploadedFileIds(prev => [...prev, ...newFileIds]);
      setUploadedFileNames(prev => [...prev, ...newFileNames]);
      
      if (!hasError) {
        toast({
          title: 'Upload Complete',
          description: `Successfully uploaded ${newFileIds.length} file(s)`,
          variant: 'success'
        });
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFileIds(prev => prev.filter((_, idx) => idx !== index));
    setUploadedFileNames(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleContinue = () => {
    // Validate that either files are uploaded or description is provided
    if (uploadedFileIds.length === 0 && description.trim() === '') {
      toast({
        title: 'Input Required',
        description: 'Please either upload files or provide a description',
        variant: 'destructive'
      });
      return;
    }
    
    onComplete(uploadedFileIds, uploadedFileNames, description);
  };

  const isValid = uploadedFileIds.length > 0 || description.trim().length > 0;
  const hasPendingFiles = files.some(f => f.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Upload Files</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload PDF, Markdown, CSV, DOCX, TXT, JPG, or PNG files to create your MCP pipeline
        </p>
      </div>
      
      {/* File Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
        }`}
      >
        <input {...getInputProps()} />
        <FiUpload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Drag & drop files here, or click to select files
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          PDF, MD, CSV, DOCX, TXT, JPG, PNG (max 50MB)
        </p>
      </div>
      
      {/* Pending Files List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Files to Upload</h4>
            {hasPendingFiles && (
              <button
                onClick={uploadFiles}
                disabled={isUploading}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  isUploading 
                    ? 'bg-gray-300 text-gray-700 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400' 
                    : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                }`}
              >
                {isUploading ? 'Uploading...' : 'Upload All'}
              </button>
            )}
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div 
                key={`${file.name}-${index}`} 
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <FiFile className="flex-shrink-0 h-4 w-4 text-gray-400" />
                  <span className="text-sm truncate max-w-xs">{file.name}</span>
                  {file.status === 'uploading' && (
                    <span className="text-xs text-blue-500">{file.progress}%</span>
                  )}
                  {file.status === 'complete' && (
                    <FiCheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <FiAlertCircle className="h-4 w-4 text-red-500" title={file.error} />
                  )}
                </div>
                
                <button 
                  onClick={() => removeFile(index)}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <FiX className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Already Uploaded Files */}
      {uploadedFileIds.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Uploaded Files</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uploadedFileNames.map((name, index) => (
              <div 
                key={`uploaded-${index}`} 
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <FiFile className="flex-shrink-0 h-4 w-4 text-gray-400" />
                  <span className="text-sm truncate max-w-xs">{name}</span>
                  <FiCheckCircle className="h-4 w-4 text-green-500" />
                </div>
                
                <button 
                  onClick={() => removeUploadedFile(index)}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <FiX className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Description Textarea */}
      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Or Describe Your Content</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Alternatively, provide a natural-language description of your content or purpose
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what your MCP server will do, what content it should know about, or what purpose it will serve..."
          className="mt-2 w-full h-32 px-3 py-2 text-base text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
        />
      </div>
    </div>
  );
}
