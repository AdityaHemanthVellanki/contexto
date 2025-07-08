'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { NodeData } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/utils/cn';

// Extend the NodeProps to include all required properties
type BaseNodeProps = NodeProps<NodeData> & {
  type?: string;
  zIndex?: number;
  isConnectable?: boolean;
  xPos?: number;
  yPos?: number;
  dragHandle?: string;
  dragging?: boolean;
};

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
  
  // Enhanced color palette with gradient options
  const nodeColors: Record<NodeData['type'], string> = {
    dataSource: 'bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700',
    chunker: 'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700',
    embedder: 'bg-gradient-to-br from-violet-400 to-violet-600 dark:from-violet-500 dark:to-violet-700',
    indexer: 'bg-gradient-to-br from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-700',
    retriever: 'bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-700',
    output: 'bg-gradient-to-br from-rose-400 to-rose-600 dark:from-rose-500 dark:to-rose-700',
  };
  
  // Node type icons as emoji characters (can be replaced with SVG icons)
  const nodeIcons: Record<NodeData['type'], string> = {
    dataSource: '📄',
    chunker: '✂️',
    embedder: '🧩',
    indexer: '🗂️',
    retriever: '🔍',
    output: '📊',
  };
  
  const backgroundColor = nodeColors[data.type];
  const icon = nodeIcons[data.type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}
      onClick={handleNodeClick}
      className={cn(
        'relative p-4 rounded-lg w-56 backdrop-blur-sm',
        'shadow-lg',
        backgroundColor,
        selected ? 'ring-2 ring-white dark:ring-white/70 border border-white/30' : 'border border-white/20',
      )}
    >
      {/* Status indicator - subtle dot showing node is active/configured */}
      {data.settings && Object.keys(data.settings).length > 0 && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />  
      )}
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 rounded-full bg-white/80 hover:bg-white border border-white/30"
      />
      
      {/* Header with icon and type */}
      <div className="flex items-center mb-2 space-x-2">
        <span className="text-lg" role="img" aria-label={data.type}>{icon}</span>
        <span className="text-white/80 font-medium text-xs uppercase tracking-wider">{data.type}</span>
      </div>
      
      {/* Node label with better typography */}
      <div className="font-semibold text-white text-sm mb-2">{data.label}</div>
      
      {/* Child content - specific to each node type */}
      <div className="mt-2">
        {children}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 rounded-full bg-white/80 hover:bg-white border border-white/30"
      />
    </motion.div>
  );
}
