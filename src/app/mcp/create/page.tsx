"use client";

import React from 'react';
import MCPCreationInterface from '@/components/MCPCreationInterface';
import { AuthProvider } from '@/contexts/AuthContext';

export default function CreateMCPPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Create MCP Server
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
          Upload a document to create a queryable MCP server with AI-powered search capabilities.
          Your document will be processed, chunked, embedded, and made available for semantic search.
        </p>
        
        <AuthProvider>
          <MCPCreationInterface className="mb-8" />
        </AuthProvider>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-3">
            About MCP Servers
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Model Context Protocol (MCP) servers provide a standardized way to connect AI systems 
            with external data sources. Each MCP server you create processes your documents and 
            makes them available for AI-powered semantic search and retrieval.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Supported File Types</h3>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>PDF Documents (.pdf)</li>
                <li>Word Documents (.docx)</li>
                <li>HTML Files (.html)</li>
                <li>Markdown Files (.md)</li>
                <li>Plain Text (.txt)</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Processing Pipeline</h3>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>Text extraction from documents</li>
                <li>Chunking with 500 token size</li>
                <li>OpenAI embeddings generation</li>
                <li>Vector similarity indexing</li>
                <li>Real-time progress tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
