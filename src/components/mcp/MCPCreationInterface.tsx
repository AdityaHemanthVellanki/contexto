'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';

interface MCPMetadata {
  id: string;
  title: string;
  fileName: string;
  description?: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  createdAt: string;
  processedAt?: string;
  numChunks?: number;
  embeddingModel: string;
  error?: string;
}

interface MCPCreationInterfaceProps {
  onMCPCreated?: (mcp: MCPMetadata) => void;
}

export default function MCPCreationInterface({ onMCPCreated }: MCPCreationInterfaceProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentMCP, setCurrentMCP] = useState<MCPMetadata | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
      setError(null);
    }
  }, []);

  const handleMCPCreation = async () => {
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Step 1: Get upload URL
      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, fileId, r2Key } = await uploadResponse.json();
      setUploadProgress(25);

      // Step 2: Upload file to R2
      const fileUploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!fileUploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setUploadProgress(50);

      // Step 3: Create MCP
      const mcpResponse = await fetch('/api/mcp/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          fileName: file.name,
          r2Key,
          title: title || file.name,
          description,
        }),
      });

      if (!mcpResponse.ok) {
        throw new Error('Failed to create MCP');
      }

      const { mcpId } = await mcpResponse.json();
      setUploadProgress(75);

      // Step 4: Listen for real-time updates
      const mcpRef = doc(db, 'mcps', user.uid, 'user_mcps', mcpId);
      const unsubscribe = onSnapshot(mcpRef, (doc) => {
        if (doc.exists()) {
          const mcpData = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            processedAt: doc.data().processedAt?.toDate?.()?.toISOString() || doc.data().processedAt,
          } as MCPMetadata;

          setCurrentMCP(mcpData);
          setUploadProgress(100);

          if (mcpData.status === 'complete') {
            setIsUploading(false);
            onMCPCreated?.(mcpData);
            // Clean up listener
            unsubscribe();
          } else if (mcpData.status === 'error') {
            setIsUploading(false);
            setError(mcpData.error || 'MCP creation failed');
            // Clean up listener
            unsubscribe();
          }
        }
      });

      // Store unsubscribe function for cleanup
      setTimeout(() => {
        if (currentMCP?.status === 'processing') {
          // Auto cleanup after 5 minutes if still processing
          unsubscribe();
          setIsUploading(false);
          setError('MCP creation timed out. Please check status manually.');
        }
      }, 300000);

    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setUploadProgress(0);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading file...';
      case 'processing':
        return 'Processing document (chunking, embedding, indexing)...';
      case 'complete':
        return 'MCP creation complete!';
      case 'error':
        return 'MCP creation failed';
      default:
        return status;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New MCP</h2>
        <p className="text-gray-600">
          Upload a document to create a Modular Context Pipeline for AI-powered querying
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Document
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            {file ? (
              <>
                <FileText className="w-12 h-12 text-blue-500 mb-2" />
                <span className="text-sm font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-900">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-500">PDF, TXT, or MD files only</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter MCP title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the content and purpose of this document"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Create Button */}
      <div className="mb-6">
        <button
          onClick={handleMCPCreation}
          disabled={!file || isUploading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Creating MCP...
            </>
          ) : (
            'Create MCP'
          )}
        </button>
      </div>

      {/* Progress Section */}
      {isUploading && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Section */}
      {currentMCP && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-2">
            {getStatusIcon(currentMCP.status)}
            <span className="ml-2 font-medium text-gray-900">
              {getStatusText(currentMCP.status)}
            </span>
          </div>
          
          {currentMCP.status === 'complete' && (
            <div className="mt-3 text-sm text-gray-600">
              <p>✅ Document processed into {currentMCP.numChunks} chunks</p>
              <p>✅ Embeddings generated using {currentMCP.embeddingModel}</p>
              <p>✅ Vector index created and ready for queries</p>
            </div>
          )}

          {currentMCP.status === 'processing' && (
            <div className="mt-3 text-sm text-gray-600">
              <p>🔄 Extracting text from document...</p>
              <p>🔄 Creating chunks with 512 tokens each...</p>
              <p>🔄 Generating embeddings via OpenAI API...</p>
              <p>🔄 Storing vectors in database...</p>
            </div>
          )}
        </div>
      )}

      {/* Error Section */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 font-medium">Error</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Success Section */}
      {currentMCP?.status === 'complete' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-green-700 font-medium">MCP Created Successfully!</span>
            </div>
            <button
              onClick={() => {
                // Navigate to MCP query interface
                window.location.href = `/mcp/${currentMCP.id}`;
              }}
              className="flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
            >
              <Eye className="w-4 h-4 mr-1" />
              View & Query
            </button>
          </div>
          <p className="text-green-600 text-sm mt-1">
            Your document is now ready for AI-powered querying and retrieval.
          </p>
        </div>
      )}
    </div>
  );
}
