import { Node, Edge } from 'reactflow';
import { NodeData } from '@/store/useCanvasStore';

interface CodeGenerationOptions {
  includeImports: boolean;
  includeComments: boolean;
  format: 'typescript' | 'javascript';
}

const defaultOptions: CodeGenerationOptions = {
  includeImports: true,
  includeComments: true,
  format: 'typescript',
};

/**
 * Generates executable code from pipeline nodes and edges
 * @param nodes Array of pipeline nodes
 * @param edges Array of pipeline connections
 * @param options Code generation options
 * @returns Generated code as string
 */
export function generatePipelineCode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options: Partial<CodeGenerationOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const { includeImports, includeComments, format } = opts;
  
  // Sort nodes by their position in the pipeline (using edge connections)
  const sortedNodes = sortNodesByPipelineOrder(nodes, edges);
  
  let code = '';
  
  // Add imports if requested
  if (includeImports) {
    code += generateImports(format);
  }
  
  // Add pipeline execution function
  code += `\n${format === 'typescript' ? 'async function' : 'async function'} executePipeline(input: string) {\n`;
  
  if (includeComments) {
    code += '  // Initialize variables to store intermediate results\n';
  }
  
  // Initialize variables for each node
  sortedNodes.forEach((node) => {
    const varName = getVariableNameForNode(node);
    code += `  let ${varName};\n`;
  });
  
  code += '\n';
  
  if (includeComments) {
    code += '  // Process each node in the pipeline\n';
  }
  
  // Generate code for each node
  sortedNodes.forEach((node, index) => {
    const varName = getVariableNameForNode(node);
    
    // Get input nodes (sources) for this node
    const inputNodes = getInputNodesForNode(node, sortedNodes, edges);
    
    // Add comments if enabled
    if (includeComments) {
      code += `\n  // Process ${node.data.label} (${node.data.type})\n`;
    }
    
    // Generate code specific to each node type
    switch (node.data.type) {
      case 'dataSource':
        code += generateDataSourceCode(node, varName);
        break;
      case 'chunker':
        code += generateChunkerCode(node, varName, inputNodes);
        break;
      case 'embedder':
        code += generateEmbedderCode(node, varName, inputNodes);
        break;
      case 'indexer':
        code += generateIndexerCode(node, varName, inputNodes);
        break;
      case 'retriever':
        code += generateRetrieverCode(node, varName, inputNodes, 'input');
        break;
      case 'output':
        code += generateOutputCode(node, varName, inputNodes);
        break;
      default:
        code += `  ${varName} = null; // Unknown node type: ${node.data.type}\n`;
    }
  });
  
  // Find the final output node (the one with no outgoing edges)
  const outputNode = findOutputNode(sortedNodes, edges);
  const outputVarName = outputNode ? getVariableNameForNode(outputNode) : 'result';
  
  // Return the final result
  code += '\n  // Return the final result\n';
  code += `  return ${outputVarName};\n`;
  code += '}\n';
  
  return code;
}

/**
 * Sort nodes according to their pipeline flow order
 */
function sortNodesByPipelineOrder(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
  // Find starting nodes (nodes with no incoming edges)
  const startNodes = nodes.filter((node) => {
    return !edges.some((edge) => edge.target === node.id);
  });
  
  // If no start nodes, just return nodes in their current order
  if (startNodes.length === 0) {
    return [...nodes];
  }
  
  // Build a graph representation
  const graph: Record<string, string[]> = {};
  nodes.forEach((node) => {
    graph[node.id] = [];
  });
  
  edges.forEach((edge) => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
    }
  });
  
  // Perform topological sort
  const visited = new Set<string>();
  const result: Node<NodeData>[] = [];
  
  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    
    visited.add(nodeId);
    
    // Visit all neighbors
    if (graph[nodeId]) {
      graph[nodeId].forEach((neighborId) => {
        visit(neighborId);
      });
    }
    
    // Add the current node to the result
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      result.unshift(node); // Add to the beginning
    }
  };
  
  // Start with all start nodes
  startNodes.forEach((node) => {
    visit(node.id);
  });
  
  // If not all nodes are visited, add the remaining ones
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      result.push(node);
    }
  });
  
  return result;
}

/**
 * Get a valid variable name for a node
 */
function getVariableNameForNode(node: Node<NodeData>): string {
  const { type } = node.data;
  const baseName = type.toLowerCase();
  const id = node.id.split('-')[1] || '';
  return `${baseName}${id}`;
}

/**
 * Find input nodes for a specific node
 */
function getInputNodesForNode(
  node: Node<NodeData>,
  allNodes: Node<NodeData>[],
  edges: Edge[]
): Node<NodeData>[] {
  // Find all edges where this node is the target
  const incomingEdges = edges.filter((edge) => edge.target === node.id);
  
  // Get the source nodes for these edges
  return incomingEdges.map((edge) => {
    return allNodes.find((n) => n.id === edge.source);
  }).filter((n): n is Node<NodeData> => n !== undefined);
}

/**
 * Find the output node (node with no outgoing edges)
 */
function findOutputNode(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData> | undefined {
  return nodes.find((node) => {
    return !edges.some((edge) => edge.source === node.id);
  });
}

/**
 * Generate import statements
 */
function generateImports(format: 'typescript' | 'javascript'): string {
  if (format === 'typescript') {
    return `import { runEmbedder } from '@/services/embeddings';
import { runSummarizer } from '@/services/summarizer';
import { runRAGQuery } from '@/services/ragQuery';
import { runRefineAnswer } from '@/services/refineAnswer';
import { logUsage } from '@/services/usage';
import { executePipeline } from '@/services/executePipeline';\n`;
  } else {
    return `const { runEmbedder } = require('@/services/embeddings');
const { runSummarizer } = require('@/services/summarizer');
const { runRAGQuery } = require('@/services/ragQuery');
const { runRefineAnswer } = require('@/services/refineAnswer');
const { logUsage } = require('@/services/usage');
const { executePipeline } = require('@/services/executePipeline');\n`;
  }
}

/**
 * Generate code for data source nodes
 */
function generateDataSourceCode(node: Node<NodeData>, varName: string): string {
  const { settings = {} } = node.data;
  const { sourceType = 'Text', filepath = '' } = settings;
  
  switch (sourceType) {
    case 'PDF':
      return `  ${varName} = await loadPDFDocument("${filepath}");\n`;
    case 'Website URL':
      return `  ${varName} = await fetchWebContent("${filepath}");\n`;
    case 'Text':
      return `  ${varName} = input; // Using direct input text\n`;
    case 'CSV':
      return `  ${varName} = await loadCSVData("${filepath}");\n`;
    case 'JSON':
      return `  ${varName} = await loadJSONData("${filepath}");\n`;
    default:
      return `  ${varName} = input; // Default to input text\n`;
  }
}

/**
 * Generate code for chunker nodes
 */
function generateChunkerCode(
  node: Node<NodeData>,
  varName: string,
  inputNodes: Node<NodeData>[]
): string {
  const { settings = {} } = node.data;
  const { chunkSize = 1000, chunkOverlap = 200, splitBy = 'token' } = settings;
  
  if (inputNodes.length === 0) {
    return `  ${varName} = []; // No input connected\n`;
  }
  
  const inputVar = getVariableNameForNode(inputNodes[0]);
  return `  ${varName} = await chunkText(${inputVar}, {
    chunkSize: ${chunkSize},
    chunkOverlap: ${chunkOverlap},
    splitBy: '${splitBy}'
  });\n`;
}

/**
 * Generate code for embedder nodes
 */
function generateEmbedderCode(
  node: Node<NodeData>,
  varName: string,
  inputNodes: Node<NodeData>[]
): string {
  const { settings = {} } = node.data;
  const { model = 'text-embedding-ada-002', dimensions = 1536 } = settings;
  
  if (inputNodes.length === 0) {
    return `  ${varName} = []; // No input connected\n`;
  }
  
  const inputVar = getVariableNameForNode(inputNodes[0]);
  return `  ${varName} = await Promise.all(${inputVar}.map(async (chunk) => {
    const embedding = await runEmbedder(chunk.text || chunk);
    return { ...chunk, embedding };
  }));\n`;
}

/**
 * Generate code for indexer nodes
 */
function generateIndexerCode(
  node: Node<NodeData>,
  varName: string,
  inputNodes: Node<NodeData>[]
): string {
  const { settings = {} } = node.data;
  const { 
    vectorStore = 'FAISS (in-memory)', 
    collectionName = 'default-collection',
    metadataFields = '' 
  } = settings;
  
  if (inputNodes.length === 0) {
    return `  ${varName} = { index: null, documents: [] }; // No input connected\n`;
  }
  
  const inputVar = getVariableNameForNode(inputNodes[0]);
  
  switch (vectorStore) {
    case 'Firestore':
      return `  ${varName} = await createFirestoreVectorStore(${inputVar}, '${collectionName}');\n`;
    case 'Pinecone':
      return `  ${varName} = await createPineconeIndex(${inputVar}, '${collectionName}');\n`;
    case 'Milvus':
      return `  ${varName} = await createMilvusCollection(${inputVar}, '${collectionName}');\n`;
    case 'FAISS (in-memory)':
    default:
      return `  ${varName} = createInMemoryVectorStore(${inputVar});\n`;
  }
}

/**
 * Generate code for retriever nodes
 */
function generateRetrieverCode(
  node: Node<NodeData>,
  varName: string,
  inputNodes: Node<NodeData>[],
  input: string
): string {
  const { settings = {} } = node.data;
  const { 
    topK = 5, 
    scoreThreshold = 0.7,
    useFilter = false 
  } = settings;
  
  if (inputNodes.length === 0) {
    return `  ${varName} = []; // No input connected\n`;
  }
  
  // Look for an index node in the inputs
  const indexNode = inputNodes.find(node => node.data.type === 'indexer');
  const indexVar = indexNode ? getVariableNameForNode(indexNode) : inputNodes[0];
  
  return `  ${varName} = await retrieveSimilarDocuments(${indexVar}, input, {
    topK: ${topK},
    scoreThreshold: ${scoreThreshold},
    useFilter: ${useFilter}
  });\n`;
}

/**
 * Generate code for output nodes
 */
function generateOutputCode(
  node: Node<NodeData>,
  varName: string,
  inputNodes: Node<NodeData>[]
): string {
  const { settings = {} } = node.data;
  const { 
    outputFormat = 'Text',
    includeMetadata = false,
    includeSourceText = true
  } = settings;
  
  if (inputNodes.length === 0) {
    return `  ${varName} = "No data available"; // No input connected\n`;
  }
  
  const retrieverNode = inputNodes.find(node => node.data.type === 'retriever');
  const inputVar = retrieverNode 
    ? getVariableNameForNode(retrieverNode) 
    : getVariableNameForNode(inputNodes[0]);
  
  return `  ${varName} = await runRAGQuery(input, ${inputVar}, {
    outputFormat: '${outputFormat}',
    includeMetadata: ${includeMetadata},
    includeSourceText: ${includeSourceText}
  });\n`;
}
