"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase-client';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { Upload, FileText, Brain, Database, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface MCPCreationProps {
  onMCPCreated?: (mcpId: string) => void;
  className?: string;
}

interface MCPStatus {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  numChunks?: number;
  embeddingModel?: string;
  vectorIndexName?: string;
  processingTime?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProcessingLog {
  id: string;
  stage: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warn';
  timestamp: Date;
  metadata?: Record<string, any>;
}

const MCPCreationInterface: React.FC<MCPCreationProps> = ({ onMCPCreated, className = '' }) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentMCP, setCurrentMCP] = useState<MCPStatus | null>(null);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Real-time MCP status listener
  useEffect(() => {
    if (!currentMCP?.id || !user) return;

    const mcpRef = doc(db, 'users', user.uid, 'mcps', currentMCP.id);
    const unsubscribe = onSnapshot(mcpRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCurrentMCP({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as MCPStatus);

        // Notify parent component when MCP is complete
        if (data.status === 'complete' && onMCPCreated) {
          onMCPCreated(doc.id);
        }
      }
    });

    return () => unsubscribe();
  }, [currentMCP?.id, user, onMCPCreated]);

  // Real-time processing logs listener
  useEffect(() => {
    if (!currentMCP?.id || !user) return;

    const logsRef = collection(db, 'users', user.uid, 'mcps', currentMCP.id, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as ProcessingLog[];
      
      setProcessingLogs(logs);
    });

    return () => unsubscribe();
  }, [currentMCP?.id, user]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const supportedTypes = ['.txt', '.pdf', '.md', '.docx', '.html'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!supportedTypes.includes(fileExtension)) {
      setError(`Unsupported file type. Supported formats: ${supportedTypes.join(', ')}`);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    
    // Auto-generate title from filename if empty
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleCreateMCP = async () => {
    if (!selectedFile || !title.trim() || !user) {
      setError('Please select a file and provide a title');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Upload file to R2
      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          contentType: selectedFile.type,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, fileId, r2Key } = await uploadResponse.json();

      // Step 2: Upload file to R2
      const fileUploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!fileUploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Create MCP
      const mcpResponse = await fetch('/api/mcp/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          fileId,
          fileName: selectedFile.name,
          r2Key,
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!mcpResponse.ok) {
        const errorData = await mcpResponse.json();
        throw new Error(errorData.error || 'Failed to create MCP');
      }

      const { mcpId } = await mcpResponse.json();
      
      // Initialize MCP status tracking
      setCurrentMCP({
        id: mcpId,
        status: 'processing',
        title: title.trim(),
        description: description.trim(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');

    } catch (error) {
      console.error('MCP creation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to create MCP');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-blue-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Create MCP Server
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Upload a document to create a queryable MCP server with AI-powered search
        </p>
      </div>

      {/* File Upload Section */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Document
          </label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PDF, DOCX, HTML, TXT, MD (MAX. 10MB)
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.html,.txt,.md"
                disabled={isUploading}
              />
            </label>
          </div>
          {selectedFile && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  ({formatFileSize(selectedFile.size)})
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter MCP server title"
            disabled={isUploading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Describe what this MCP server contains"
            disabled={isUploading}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleCreateMCP}
          disabled={!selectedFile || !title.trim() || isUploading}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Creating MCP Server...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Create MCP Server
            </>
          )}
        </button>
      </div>

      {/* Processing Status */}
      {currentMCP && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="mb-4">
            <div className="flex items-center space-x-3 mb-2">
              {getStatusIcon(currentMCP.status)}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentMCP.title}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {currentMCP.description}
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>File: {currentMCP.fileName}</span>
              <span>Size: {formatFileSize(currentMCP.fileSize)}</span>
              {currentMCP.numChunks && <span>Chunks: {currentMCP.numChunks}</span>}
              {currentMCP.processingTime && <span>Time: {currentMCP.processingTime}ms</span>}
            </div>
          </div>

          {/* Processing Logs */}
          {processingLogs.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Database className="w-4 h-4 mr-2" />
                Processing Logs
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {processingLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-2 text-xs">
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {log.stage}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">
                        {log.message}
                      </p>
                      {log.metadata && (
                        <pre className="text-gray-500 dark:text-gray-400 mt-1 text-xs">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success State */}
          {currentMCP.status === 'complete' && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                    MCP Server Ready!
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your document has been processed and is ready for AI-powered queries.
                    {currentMCP.numChunks && ` Created ${currentMCP.numChunks} searchable chunks.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {currentMCP.status === 'error' && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Processing Failed
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {currentMCP.error || 'An error occurred during processing.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MCPCreationInterface;
