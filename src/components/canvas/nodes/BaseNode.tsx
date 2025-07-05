'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { NodeData } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/utils/cn';

type BaseNodeProps = NodeProps<NodeData>;

export default function BaseNode({ 
  id, 
  data, 
  selected, 
  children 
}: BaseNodeProps & { children?: React.ReactNode }) {
  const { setActiveNodeId, setIsDrawerOpen } = useChatStore();

  const handleNodeClick = () => {
    setActiveNodeId(id);
    setIsDrawerOpen(true);
  };
  
  const nodeColors: Record<NodeData['type'], string> = {
    dataSource: 'bg-blue-500 dark:bg-blue-600',
    chunker: 'bg-green-500 dark:bg-green-600',
    embedder: 'bg-purple-500 dark:bg-purple-600',
    indexer: 'bg-yellow-500 dark:bg-yellow-600',
    retriever: 'bg-orange-500 dark:bg-orange-600',
    output: 'bg-pink-500 dark:bg-pink-600',
  };
  
  const backgroundColor = nodeColors[data.type];

  return (
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={handleNodeClick}
      className={cn(
        'relative p-4 rounded-md shadow-md w-60',
        'border-2',
        backgroundColor,
        selected ? 'border-white ring-2 ring-blue-300 dark:ring-blue-500' : 'border-transparent',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-800 dark:bg-white"
      />
      
      <div className="text-white font-medium text-sm mb-2">{data.type}</div>
      <div className="font-semibold text-white">{data.label}</div>
      
      {children}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-800 dark:bg-white"
      />
    </motion.div>
  );
}
