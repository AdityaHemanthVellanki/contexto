'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiDatabase, FiSearch } from 'react-icons/fi';
import { HiOutlinePuzzle, HiOutlineDocumentText, HiOutlineDatabase } from 'react-icons/hi';
import { BiNetworkChart } from 'react-icons/bi';
import { useCanvasStore, NodeData } from '@/store/useCanvasStore';
import { cn } from '@/utils/cn';

// Define node types with their metadata
const nodeTypes = [
  {
    type: 'dataSource',
    label: 'Data Source',
    description: 'Connect to data from files, APIs, or databases',
    icon: FiDatabase,
    color: 'bg-blue-500 dark:bg-blue-600',
  },
  {
    type: 'chunker',
    label: 'Chunker',
    description: 'Split text into manageable pieces',
    icon: HiOutlinePuzzle,
    color: 'bg-green-500 dark:bg-green-600',
  },
  {
    type: 'embedder',
    label: 'Embedder',
    description: 'Convert text to vector embeddings',
    icon: BiNetworkChart,
    color: 'bg-purple-500 dark:bg-purple-600',
  },
  {
    type: 'indexer',
    label: 'Indexer',
    description: 'Store and index embeddings',
    icon: HiOutlineDatabase,
    color: 'bg-yellow-500 dark:bg-yellow-600',
  },
  {
    type: 'retriever',
    label: 'Retriever',
    description: 'Search for relevant context',
    icon: FiSearch,
    color: 'bg-orange-500 dark:bg-orange-600',
  },
  {
    type: 'output',
    label: 'Output',
    description: 'Format and return the final result',
    icon: HiOutlineDocumentText,
    color: 'bg-pink-500 dark:bg-pink-600',
  },
];

export default function NodePalette() {
  const { addNode } = useCanvasStore();
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNode(nodeType);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
  };
  
  // When a node is dropped on the canvas, the onDrop handler in CanvasArea will handle the node creation
  // But we can also add a function to create a node programmatically
  const handleAddNode = (nodeType: string, nodeLabel: string) => {
    const newNode = {
      id: `${nodeType}-${crypto.randomUUID().substring(0, 8)}`,
      type: nodeType,
      position: { x: 100, y: 100 + Math.random() * 100 }, // Random position
      data: {
        type: nodeType as NodeData['type'],
        label: nodeLabel,
        settings: {},
      },
    };
    
    addNode(newNode);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Node Types</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Drag nodes onto the canvas to build your pipeline
      </p>
      
      <div className="grid gap-4">
        {nodeTypes.map((nodeType) => (
          <motion.div
            key={nodeType.type}
            draggable
            onDragStart={(e) => handleDragStart(e, nodeType.type)}
            onDragEnd={handleDragEnd}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'p-4 rounded-lg shadow-sm cursor-move border-2 border-transparent',
              nodeType.color,
              draggedNode === nodeType.type && 'ring-2 ring-white border-white'
            )}
          >
            <div className="flex items-center">
              <div className="p-2 bg-white/10 rounded-md">
                <nodeType.icon className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="font-medium text-white">{nodeType.label}</h3>
                <p className="text-xs text-white/80 mt-1">{nodeType.description}</p>
              </div>
            </div>
            
            <button 
              onClick={() => handleAddNode(nodeType.type, nodeType.label)}
              className="mt-3 w-full py-1 px-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded transition-colors"
              aria-label={`Add ${nodeType.label} node`}
            >
              Add to Canvas
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
