'use client';

import { useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Node,
  Edge,
  useReactFlow,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  ReactFlowProvider,
} from 'reactflow';
import { useCanvasStore, NodeData } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';
import { FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi';

// Import custom node types
import DataSourceNode from './nodes/DataSourceNode';
import ChunkerNode from './nodes/ChunkerNode';
import EmbedderNode from './nodes/EmbedderNode';
import IndexerNode from './nodes/IndexerNode';
import RetrieverNode from './nodes/RetrieverNode';
import OutputNode from './nodes/OutputNode';
import NodeConfigDrawer from '../drawers/NodeConfigDrawer';

// Import the required React Flow styles
import 'reactflow/dist/style.css';

// SafeReactFlow wrapper to ensure nodes and edges are always arrays
interface SafeReactFlowProps {
  nodes: any;
  edges: any;
  [key: string]: any;
}

function SafeReactFlow({ nodes, edges, ...rest }: SafeReactFlowProps) {
  const safeNodes = useMemo(() => {
    return Array.isArray(nodes) ? nodes : [];
  }, [nodes]);
  
  const safeEdges = useMemo(() => {
    return Array.isArray(edges) ? edges : [];
  }, [edges]);
  
  return (
    <ReactFlow
      nodes={safeNodes}
      edges={safeEdges}
      {...rest}
    />
  );
}

// Register custom node types
const nodeTypes = {
  dataSource: DataSourceNode,
  chunker: ChunkerNode,
  embedder: EmbedderNode,
  indexer: IndexerNode,
  retriever: RetrieverNode,
  output: OutputNode,
};

function CanvasAreaContent() {
  const reactFlowInstance = useReactFlow();
  const [zoom, setZoom] = useState(1);
  
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNode,
    canvasSettings,
  } = useCanvasStore();
  
  const { setIsDrawerOpen } = useChatStore();
  
  // Handle zoom actions
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
  }, [reactFlowInstance]);

  const handleZoomReset = useCallback(() => {
    reactFlowInstance.fitView();
  }, [reactFlowInstance]);
  
  // Handle node selection
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNode(node);
      setIsDrawerOpen(true);
    },
    [setSelectedNode, setIsDrawerOpen]
  );
  
  // Handle node changes (position, selection)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, nodes || []) as Node<NodeData>[]);
    },
    [setNodes, nodes]
  );
  
  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges || []));
    },
    [setEdges, edges]
  );
  
  // Handle connecting nodes
  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges(addEdge({
        ...connection, 
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#2563eb', strokeWidth: 2 }
      }, edges || []));
    },
    [setEdges, edges]
  );
  
  // Handle dropping a new node onto the canvas
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      
      const nodeType = event.dataTransfer.getData('application/reactflow');
      
      // Check if the dragged item is a valid node type
      if (!nodeType || !Object.keys(nodeTypes).includes(nodeType)) return;
      
      // Get position of the drop relative to the canvas
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      // Create a new node
      const newNode: Node<NodeData> = {
        id: `${nodeType}-${crypto.randomUUID().substring(0, 8)}`,
        type: nodeType,
        position,
        data: { 
          type: nodeType, 
          label: `New ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}`,
          settings: {}
        },
      };
      
      // Add the node to the canvas
      setNodes([...(nodes || []), newNode]);
    },
    [reactFlowInstance, setNodes, nodes]
  );
  
  return (
    <div className="h-full w-full relative rounded-lg overflow-hidden">
      <motion.div 
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <SafeReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onDrop={handleDrop}
          onDragOver={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
          snapToGrid={canvasSettings.snapToGrid}
          snapGrid={[canvasSettings.gridSize, canvasSettings.gridSize]}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Control', 'Meta']}
          selectionKeyCode={null}
          className="rounded-lg"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={canvasSettings.gridSize}
            size={1}
            color="#e2e8f0"
            className="dark:bg-gray-900"
          />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-white dark:bg-gray-800 rounded-md shadow-md border border-gray-200 dark:border-gray-700"
            style={{ opacity: 0.9 }}
          />
          <Controls
            className="bg-white dark:bg-gray-800 rounded-md shadow-md border border-gray-200 dark:border-gray-700"
            style={{ opacity: 0.9 }}
          />
        </SafeReactFlow>
      </motion.div>
      
      {/* Centered Title */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm text-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Pipeline Canvas</span>
        </div>
      </div>
      
      {/* Zoom Controls - Now at bottom right for better UX */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleZoomIn}
          className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Zoom in"
        >
          <FiZoomIn className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleZoomOut}
          className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Zoom out"
        >
          <FiZoomOut className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleZoomReset}
          className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Reset zoom"
        >
          <FiMaximize className="w-4 h-4" />
        </motion.button>
      </div>
      
      {/* Node Configuration Drawer */}
      <NodeConfigDrawer />
    </div>
  );
}

export default function CanvasArea() {
  return (
    <ReactFlowProvider>
      <CanvasAreaContent />
    </ReactFlowProvider>
  );
}
