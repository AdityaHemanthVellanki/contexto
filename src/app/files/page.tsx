'use client';

import { useState, useEffect } from 'react';
import { Metadata } from 'next';

// Ensure page title is detectable by tests
if (typeof document !== 'undefined') {
  document.title = 'Files - Contexto';
}
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, where } from 'firebase/firestore';
import { DocumentIcon, TrashIcon, ArrowDownTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatBytes, formatDate } from '@/lib/utils';

interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: any;
  status: string;
}

export default function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Load files from Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const uploadsRef = collection(db, 'uploads');
    const q = query(
      uploadsRef,
      where('userId', '==', user.uid),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesList: UploadedFile[] = [];
      snapshot.forEach((doc) => {
        filesList.push({
          id: doc.id,
          ...doc.data()
        } as UploadedFile);
      });
      setFiles(filesList);
      setLoading(false);
    }, (error) => {
      console.error('Error loading files:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);

    try {
      // Get Firebase ID token
      const idToken = await user.getIdToken();

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();
      console.log('File uploaded successfully:', result);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!user?.uid) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      // Delete from Firestore (R2 cleanup would need a separate API endpoint)
      const fileRef = doc(db, 'uploads', fileId);
      await deleteDoc(fileRef);
      
      // TODO: Call API endpoint to delete from R2 storage
      // await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (fileType: string) => {
    // Return appropriate icon based on file type
    return <DocumentIcon className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="files-page-title">Files</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="files-page-description">
              Manage your uploaded files and documents
            </p>
          </div>
          
          {/* Upload Button */}
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".txt,.csv,.json,.pdf,.md,.docx,.pptx,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <PlusIcon className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload New File'}
            </label>
          </div>
        </div>

        {/* Files Table */}
        {files.length === 0 ? (
          <div className="text-center py-12">
            <DocumentIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No files uploaded yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your first file to get started with building MCP pipelines
            </p>
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Upload File
            </label>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.fileType)}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {file.fileName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {file.status}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {file.fileType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatBytes(file.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(file.uploadedAt?.toDate?.() || new Date())}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(file.fileUrl, file.fileName)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1 rounded"
                            title="Download"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(file.id, file.fileName)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
