'use client';

import { useState } from 'react';
import { FiFile, FiTool, FiLoader, FiCheck } from 'react-icons/fi';

interface Tool {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
}

interface ReviewLaunchStepProps {
  fileNames: string[];
  description: string;
  tools: Tool[];
  autoGenerateTools: boolean;
  isProcessing: boolean;
  onLaunch: () => void;
  onNameChange: (name: string) => void;
}

export default function ReviewLaunchStep({
  fileNames,
  description,
  tools,
  autoGenerateTools,
  isProcessing,
  onLaunch,
  onNameChange
}: ReviewLaunchStepProps) {
  const [pipelineName, setPipelineName] = useState(`MCP Pipeline ${new Date().toLocaleDateString()}`);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPipelineName(e.target.value);
    onNameChange(e.target.value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Review & Launch</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review your MCP pipeline configuration and launch processing
        </p>
      </div>
      
      {/* Pipeline Name */}
      <div>
        <label htmlFor="pipelineName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Pipeline Name
        </label>
        <input
          id="pipelineName"
          type="text"
          value={pipelineName}
          onChange={handleNameChange}
          className="mt-1 w-full px-3 py-2 text-base text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
          placeholder="Give your pipeline a descriptive name"
        />
      </div>
      
      {/* Summary Sections */}
      <div className="space-y-4">
        {/* Files Section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
            <FiFile className="mr-2 h-4 w-4" /> Files
          </h4>
          
          {fileNames.length > 0 ? (
            <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {fileNames.map((name, index) => (
                <li key={`file-${index}`} className="text-sm text-gray-600 dark:text-gray-400">
                  • {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
              No files uploaded
            </p>
          )}
        </div>
        
        {/* Description Section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Description</h4>
          
          {description ? (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {description}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
              No description provided
            </p>
          )}
        </div>
        
        {/* Tools Section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
            <FiTool className="mr-2 h-4 w-4" /> Tools
            {autoGenerateTools && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                Auto-generated
              </span>
            )}
          </h4>
          
          {tools.length > 0 ? (
            <div className="mt-2 space-y-3 max-h-48 overflow-y-auto">
              {tools.map((tool, index) => (
                <div key={`tool-summary-${index}`} className="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">{tool.name}</h5>
                  
                  {tool.description && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </p>
                  )}
                  
                  {tool.parameters.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Parameters:</p>
                      <ul className="mt-1 space-y-1">
                        {tool.parameters.map((param, paramIdx) => (
                          <li key={`param-summary-${index}-${paramIdx}`} className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{param.name}</span>
                            <span className="text-gray-400 dark:text-gray-500"> ({param.type})</span>
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                            {param.description && (
                              <span className="block text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {param.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
              No tools defined
            </p>
          )}
        </div>
      </div>
      
      {/* Processing Details */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Processing Pipeline</h4>
        <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
          When you click "Start Processing", the following steps will be executed:
        </p>
        <ul className="mt-2 space-y-1">
          <li className="flex items-center text-xs text-blue-700 dark:text-blue-300">
            <FiCheck className="mr-1 h-3 w-3" /> Extract text from uploaded files
          </li>
          <li className="flex items-center text-xs text-blue-700 dark:text-blue-300">
            <FiCheck className="mr-1 h-3 w-3" /> Split content into chunks for processing
          </li>
          <li className="flex items-center text-xs text-blue-700 dark:text-blue-300">
            <FiCheck className="mr-1 h-3 w-3" /> Generate embeddings via Azure OpenAI
          </li>
          <li className="flex items-center text-xs text-blue-700 dark:text-blue-300">
            <FiCheck className="mr-1 h-3 w-3" /> Index vectors in Pinecone for fast retrieval
          </li>
          <li className="flex items-center text-xs text-blue-700 dark:text-blue-300">
            <FiCheck className="mr-1 h-3 w-3" /> Configure RAG pipeline for chat interactions
          </li>
        </ul>
      </div>
      
      {/* Launch Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onLaunch}
          disabled={isProcessing}
          className={`px-6 py-3 text-base font-medium text-white rounded-md shadow-sm flex items-center ${
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600'
              : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'
          }`}
        >
          {isProcessing ? (
            <>
              <FiLoader className="animate-spin mr-2 h-5 w-5" />
              Processing...
            </>
          ) : (
            <>
              <FiCheck className="mr-2 h-5 w-5" />
              Start Processing
            </>
          )}
        </button>
      </div>
    </div>
  );
}
