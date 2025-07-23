import { create } from 'zustand';
import { 
  Node, 
  Edge,
  addEdge,
  Connection,
  applyNodeChanges, 
  applyEdgeChanges, 
  NodeChange,
  EdgeChange
} from 'reactflow';

// Define types for node data
export interface NodeData {
  type: string;
  label: string;
  settings?: Record<string, any>;
  [key: string]: any;
}

// Define canvas settings type
export interface CanvasSettings {
  snapToGrid: boolean;
  gridSize: number;
  zoomLevel: number;
  pipelineName: string;
  showMinimap: boolean;
  showControls: boolean;
}

// Define canvas store state
interface CanvasState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNode: Node<NodeData> | null;
  canvasSettings: CanvasSettings;
  
  // Actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<NodeData>) => void;
  updateNodeData: (nodeId: string, data: NodeData) => void;
  deleteNode: (nodeId: string) => void;
  setSelectedNode: (node: Node<NodeData> | null) => void;
  clearSelectedNode: () => void;
  updateCanvasSettings: (settings: Partial<CanvasSettings>) => void;
  resetCanvas: () => void;
  initializeCanvas: () => void;
  deleteEdge: (edgeId: string) => void;
  loadGeneratedPipeline: (pipelineJson: any) => void;
}

// Default canvas settings
const defaultCanvasSettings: CanvasSettings = {
  snapToGrid: true,
  gridSize: 20,
  zoomLevel: 1,
  pipelineName: 'My Pipeline',
  showMinimap: true,
  showControls: true
};

// Initial empty canvas
const initialNodes: Node<NodeData>[] = [];
const initialEdges: Edge[] = [];

// Create the store
export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNode: null,
  canvasSettings: { ...defaultCanvasSettings },
  
  // Set all nodes
  setNodes: (nodes) => set({ nodes: Array.isArray(nodes) ? nodes : [] }),
  
  // Set all edges
  setEdges: (edges) => set({ edges: Array.isArray(edges) ? edges : [] }),
  
  // Apply changes to nodes (position, selection, etc.)
  onNodesChange: (changes) => 
    set({
      nodes: applyNodeChanges(changes, get().nodes || []) as Node<NodeData>[]
    }),
  
  // Apply changes to edges
  onEdgesChange: (changes) => 
    set({
      edges: applyEdgeChanges(changes, get().edges || [])
    }),
  
  // Connect nodes with an edge
  onConnect: (connection) => 
    set({
      edges: addEdge({
        ...connection, 
        animated: true,
        style: { stroke: '#2563eb', strokeWidth: 2 },
        type: 'smoothstep'
      }, get().edges || [])
    }),
  
  // Add a new node
  addNode: (node) => 
    set({
      nodes: [...(get().nodes || []), node]
    }),
  
  // Update node data
  updateNodeData: (nodeId, data) => 
    set({
      nodes: (get().nodes || []).map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    }),
  
  // Delete a node and its connected edges
  deleteNode: (nodeId) => {
    const nodes = get().nodes || [];
    const edges = get().edges || [];
    
    const nodesToDelete = nodes.filter((node) => node.id === nodeId);
    if (nodesToDelete.length === 0) return;
    
    // Also remove any edges connected to this node
    const edgesToKeep = edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    );
    
    set({
      nodes: nodes.filter((node) => node.id !== nodeId),
      edges: edgesToKeep,
      selectedNode: get().selectedNode?.id === nodeId ? null : get().selectedNode
    });
  },
  
  // Set the selected node
  setSelectedNode: (node) => set({ selectedNode: node }),
  
  // Clear the selected node
  clearSelectedNode: () => set({ selectedNode: null }),
  
  // Update canvas settings
  updateCanvasSettings: (settings) => 
    set({
      canvasSettings: {
        ...get().canvasSettings,
        ...settings
      }
    }),
  
  // Reset canvas to initial state
  resetCanvas: () => 
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      canvasSettings: { ...defaultCanvasSettings }
    }),
  
  // Initialize canvas with default nodes (e.g., after login)
  initializeCanvas: () => {
    const initialNodes: Node<NodeData>[] = [
      {
        id: 'dataSource-1',
        type: 'dataSource',
        position: { x: 100, y: 100 },
        data: { 
          type: 'dataSource', 
          label: 'PDF Loader',
          settings: {
            sourceType: 'PDF',
            filepath: '',
          }
        }
      },
      {
        id: 'chunker-1',
        type: 'chunker',
        position: { x: 100, y: 250 },
        data: { 
          type: 'chunker', 
          label: 'Text Splitter',
          settings: {
            chunkSize: 1000,
            chunkOverlap: 200,
            splitBy: 'token'
          }
        }
      },
    ];
    
    const initialEdges: Edge[] = [
      {
        id: 'edge-1',
        source: 'dataSource-1',
        target: 'chunker-1',
        animated: true,
        style: { stroke: '#2563eb', strokeWidth: 2 },
        type: 'smoothstep'
      },
    ];
    
    set({
      nodes: initialNodes,
      edges: initialEdges
    });
  },
  
  // Delete an edge by ID
  deleteEdge: (edgeId) => 
    set({
      edges: (get().edges || []).filter((edge) => edge.id !== edgeId)
    }),
  
  // Load a generated pipeline into the canvas
  loadGeneratedPipeline: (pipelineJson) => {
    try {
      // Convert generated nodes to canvas format
      const canvasNodes: Node<NodeData>[] = (pipelineJson.nodes || []).map((node: any) => ({
        id: node.id,
        type: node.type.toLowerCase(), // Ensure lowercase for node types
        position: node.position,
        data: {
          type: node.type.toLowerCase(),
          label: node.data?.label || `${node.type} Node`,
          settings: node.data?.config || {}
        }
      }));
      
      // Convert generated edges to canvas format
      const canvasEdges: Edge[] = (pipelineJson.edges || []).map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
        animated: edge.animated !== false,
        style: { stroke: '#2563eb', strokeWidth: 2 }
      }));
      
      // Update pipeline name if provided
      const pipelineName = pipelineJson.metadata?.name || 'Generated Pipeline';
      
      set({
        nodes: canvasNodes,
        edges: canvasEdges,
        selectedNode: null,
        canvasSettings: {
          ...get().canvasSettings,
          pipelineName
        }
      });
    } catch (error) {
      console.error('Failed to load generated pipeline:', error);
      // No fallbacks - propagate the error
      throw new Error(`Pipeline loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}));
