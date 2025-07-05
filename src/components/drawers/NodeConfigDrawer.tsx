'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSave, FiTrash2 } from 'react-icons/fi';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/utils/cn';

// Node-specific form fields mapping
const nodeFormFields: Record<string, Array<{ id: string; label: string; type: string; options?: string[]; placeholder?: string; helperText?: string }>> = {
  dataSource: [
    { id: 'sourceType', label: 'Source Type', type: 'select', options: ['PDF', 'Website URL', 'Text', 'CSV', 'JSON'] },
    { id: 'filepath', label: 'File Path or URL', type: 'text', placeholder: 'e.g., /path/to/file.pdf or https://example.com' },
    { id: 'recursive', label: 'Recursive Processing', type: 'checkbox', helperText: 'Process nested folders or linked pages' },
  ],
  chunker: [
    { id: 'chunkSize', label: 'Chunk Size (tokens)', type: 'number', placeholder: '1000' },
    { id: 'chunkOverlap', label: 'Chunk Overlap', type: 'number', placeholder: '200' },
    { id: 'splitBy', label: 'Split By', type: 'select', options: ['token', 'character', 'sentence', 'paragraph'] },
  ],
  embedder: [
    { id: 'model', label: 'Embedding Model', type: 'select', options: ['text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'] },
    { id: 'dimensions', label: 'Dimensions', type: 'number', placeholder: '1536' },
    { id: 'normalize', label: 'Normalize Vectors', type: 'checkbox', helperText: 'Normalize vector values to unit length' },
  ],
  indexer: [
    { id: 'vectorStore', label: 'Vector Store', type: 'select', options: ['Firestore', 'Pinecone', 'Milvus', 'FAISS (in-memory)'] },
    { id: 'collectionName', label: 'Collection Name', type: 'text', placeholder: 'my-collection' },
    { id: 'metadataFields', label: 'Metadata Fields', type: 'text', placeholder: 'title,url,date' },
  ],
  retriever: [
    { id: 'topK', label: 'Top K Results', type: 'number', placeholder: '5' },
    { id: 'scoreThreshold', label: 'Minimum Score Threshold', type: 'number', placeholder: '0.7' },
    { id: 'useFilter', label: 'Use Metadata Filters', type: 'checkbox', helperText: 'Filter results based on metadata' },
  ],
  output: [
    { id: 'outputFormat', label: 'Output Format', type: 'select', options: ['Text', 'JSON', 'Markdown', 'HTML'] },
    { id: 'includeMetadata', label: 'Include Metadata', type: 'checkbox', helperText: 'Include document metadata in output' },
    { id: 'includeSourceText', label: 'Include Source Text', type: 'checkbox', helperText: 'Include original source text in output' },
  ]
};

export default function NodeConfigDrawer() {
  const { 
    selectedNode,
    clearSelectedNode,
    updateNodeData,
    deleteNode
  } = useCanvasStore();
  
  const { isDrawerOpen, setIsDrawerOpen } = useChatStore();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  
  // When a new node is selected, populate form with its data
  useEffect(() => {
    if (selectedNode) {
      setIsDrawerOpen(true);
      setFormValues(selectedNode.data.settings || {});
    } else {
      setIsDrawerOpen(false);
    }
  }, [selectedNode, setIsDrawerOpen]);
  
  const handleClose = () => {
    clearSelectedNode();
    setIsDrawerOpen(false);
  };
  
  const handleFormChange = (id: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  const handleSave = () => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, {
        ...selectedNode.data,
        settings: formValues
      });
      handleClose();
    }
  };
  
  const handleDelete = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
      handleClose();
    }
  };
  
  // Helper to render appropriate form field based on type
  const renderField = (field: { id: string; label: string; type: string; options?: string[]; placeholder?: string; helperText?: string }) => {
    const { id, label, type, options, placeholder, helperText } = field;
    
    switch (type) {
      case 'text':
        return (
          <input
            type="text"
            id={id}
            value={formValues[id] || ''}
            onChange={(e) => handleFormChange(id, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        );
        
      case 'number':
        return (
          <input
            type="number"
            id={id}
            value={formValues[id] || ''}
            onChange={(e) => handleFormChange(id, parseInt(e.target.value) || e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        );
        
      case 'select':
        return (
          <select
            id={id}
            value={formValues[id] || ''}
            onChange={(e) => handleFormChange(id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select {label}</option>
            {options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
        
      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={id}
              checked={formValues[id] || false}
              onChange={(e) => handleFormChange(id, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={id} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {label}
            </label>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  if (!selectedNode) return null;
  
  const nodeType = selectedNode.data.type;
  const fields = nodeFormFields[nodeType] || [];
  
  return (
    <motion.div 
      className={cn(
        "fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-lg z-50 overflow-y-auto",
        "border-l border-gray-200 dark:border-gray-700",
        !isDrawerOpen && "hidden"
      )}
      initial={{ x: '100%' }}
      animate={{ x: isDrawerOpen ? 0 : '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {selectedNode.data.label || `Configure ${nodeType}`}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Node Label Input */}
          <div>
            <label htmlFor="node-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Node Label
            </label>
            <input
              type="text"
              id="node-label"
              value={formValues.label || selectedNode.data.label || ''}
              onChange={(e) => handleFormChange('label', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          {/* Node-specific fields */}
          {fields.map((field) => (
            <div key={field.id} className="space-y-1">
              {field.type !== 'checkbox' && (
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                </label>
              )}
              {renderField(field)}
              {field.helperText && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {field.helperText}
                </p>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-8 space-y-3">
          <button
            onClick={handleSave}
            className="w-full flex justify-center items-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-colors"
          >
            <FiSave className="mr-2 w-4 h-4" />
            Save Changes
          </button>
          
          <button
            onClick={handleDelete}
            className="w-full flex justify-center items-center py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md shadow transition-colors"
          >
            <FiTrash2 className="mr-2 w-4 h-4" />
            Delete Node
          </button>
        </div>
      </div>
    </motion.div>
  );
}
