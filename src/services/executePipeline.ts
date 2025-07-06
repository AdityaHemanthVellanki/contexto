import { runEmbedder } from './embeddings';
import { runSummarizer } from './summarizer';
import { runRAGQuery } from './ragQuery';
import { runRefineAnswer } from './refineAnswer';
import { TokenUsage } from './usage';

// Define the Graph and Node types for TypeScript
export interface Node {
  id: string;
  type: 'dataSource' | 'chunker' | 'embedder' | 'indexer' | 'retriever' | 'output';
  data: {
    type: string;
    label: string;
    settings: Record<string, any>;
  };
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface NodeUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface UsageReport {
  [nodeId: string]: NodeUsage;
  total: NodeUsage;
}

/**
 * Performs a topological sort on the graph
 * 
 * @param nodes List of nodes in the graph
 * @param edges List of edges in the graph
 * @returns Topologically sorted list of nodes
 * @throws Error if the graph has a cycle
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  // Create an adjacency list
  const graph: Record<string, string[]> = {};
  nodes.forEach(node => {
    graph[node.id] = [];
  });
  
  edges.forEach(edge => {
    if (graph[edge.source]) {
      graph[edge.source].push(edge.target);
    }
  });
  
  // Count incoming edges for each node
  const inDegree: Record<string, number> = {};
  nodes.forEach(node => {
    inDegree[node.id] = 0;
  });
  
  edges.forEach(edge => {
    inDegree[edge.target]++;
  });
  
  // Queue nodes with no incoming edges
  const queue: string[] = [];
  Object.keys(inDegree).forEach(nodeId => {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  });
  
  // Process the queue
  const sortedNodeIds: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sortedNodeIds.push(nodeId);
    
    graph[nodeId].forEach(targetId => {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        queue.push(targetId);
      }
    });
  }
  
  // Check for cycles
  if (sortedNodeIds.length !== nodes.length) {
    throw new Error('Pipeline graph contains cycles');
  }
  
  // Map the sorted IDs back to nodes
  const nodeMap: Record<string, Node> = {};
  nodes.forEach(node => {
    nodeMap[node.id] = node;
  });
  
  return sortedNodeIds.map(id => nodeMap[id]);
}

/**
 * Executes a pipeline based on the provided graph and prompt
 * 
 * @param graph The pipeline graph with nodes and edges
 * @param prompt The user prompt to process
 * @param userId Authenticated user ID for usage tracking
 * @returns The result and usage report
 * @throws Error if any stage of pipeline execution fails
 */
export async function executePipeline(graph: Graph, prompt: string, userId: string) {
  if (!graph || !graph.nodes || !graph.edges) {
    throw new Error('Invalid pipeline graph structure');
  }
  
  if (!userId) {
    throw new Error('User ID is required for pipeline execution');
  }
  
  // Store intermediate results and usage
  const nodeResults: Record<string, any> = {};
  const usageReport: UsageReport = {
    total: { promptTokens: 0, completionTokens: 0 }
  };
  
  try {
    // Topologically sort nodes
    const sortedNodes = topologicalSort(graph.nodes, graph.edges);
    
    // Process each node in order
    for (const node of sortedNodes) {
      const { id, type, data } = node;
      
      // Get inputs to this node
      const inputEdges = graph.edges.filter(edge => edge.target === id);
      const inputNodes = inputEdges.map(edge => edge.source);
      const inputData = inputNodes.map(nodeId => nodeResults[nodeId]).filter(Boolean);
      
      // Initialize usage tracking for this node
      usageReport[id] = { promptTokens: 0, completionTokens: 0 };
      
      // Execute based on node type
      switch (type) {
        case 'dataSource': {
          // Data source node - currently we only support text input
          if (data.settings.sourceType === 'text') {
            nodeResults[id] = data.settings.text || prompt;
          } else if (data.settings.sourceType === 'prompt') {
            // Use the user prompt directly
            nodeResults[id] = prompt;
          } else {
            throw new Error(`Unsupported data source type: ${data.settings.sourceType}`);
          }
          break;
        }
          
        case 'chunker': {
          // Split text into chunks based on settings
          const inputText = inputData[0] || '';
          
          if (!inputText) {
            throw new Error('Chunker received empty input');
          }
          
          const chunkSize = data.settings.chunkSize || 1000;
          const chunkOverlap = data.settings.chunkOverlap || 0;
          
          if (chunkSize <= 0) {
            throw new Error('Chunk size must be greater than 0');
          }
          
          if (chunkOverlap >= chunkSize) {
            throw new Error('Chunk overlap must be less than chunk size');
          }
          
          // Create chunks with overlap
          const chunks: string[] = [];
          const text = String(inputText);
          const step = chunkSize - chunkOverlap;
          
          for (let i = 0; i < text.length; i += step) {
            chunks.push(text.substring(i, i + chunkSize));
          }
          
          if (chunks.length === 0) {
            throw new Error('Chunking resulted in 0 chunks');
          }
          
          nodeResults[id] = chunks;
          break;
        }
          
        case 'embedder': {
          // Get chunks from previous node
          const chunks = inputData[0];
          
          if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            throw new Error('Embedder requires text chunks as input');
          }
          
          // Generate embeddings through Azure OpenAI
          const embeddings = await runEmbedder(chunks, userId);
          
          if (!embeddings || embeddings.length === 0) {
            throw new Error('Embedding generation failed to return results');
          }
          
          nodeResults[id] = {
            chunks,
            embeddings
          };
          
          // Track token usage
          // Note: Real usage is tracked within runEmbedder and logged to Firestore
          const tokenEstimate = chunks.reduce((acc, chunk) => acc + chunk.length, 0) / 4;
          usageReport[id].promptTokens = tokenEstimate;
          usageReport.total.promptTokens += tokenEstimate;
          break;
        }
          
        case 'indexer': {
          // Get chunks and embeddings
          const { chunks, embeddings } = inputData[0] || {};
          
          if (!chunks || !embeddings || !Array.isArray(chunks) || !Array.isArray(embeddings)) {
            throw new Error('Indexer requires chunks and embeddings as input');
          }
          
          if (chunks.length !== embeddings.length) {
            throw new Error('Number of chunks and embeddings must match');
          }
          
          // Create an in-memory vector index
          const index = chunks.map((chunk, i) => ({
            text: chunk,
            embedding: embeddings[i],
          }));
          
          nodeResults[id] = index;
          break;
        }
          
        case 'retriever': {
          // Get the index and query
          const index = inputData[0];
          
          if (!index || !Array.isArray(index) || index.length === 0) {
            throw new Error('Retriever requires an index as input');
          }
          
          // Get retriever settings
          const queryText = prompt;
          const topK = data.settings.topK || 3;
          
          // In production, this would perform semantic search
          // For now, we'll return the first topK documents as a simplified implementation
          const retrievedDocs = index.slice(0, topK).map(item => item.text);
          
          nodeResults[id] = retrievedDocs;
          break;
        }
          
        case 'output': {
          // Process output based on format setting
          const inputText = inputData[0];
          const outputFormat = data.settings.outputFormat || 'rag';
          
          if (!inputText) {
            throw new Error('Output node received empty input');
          }
          
          let result;
          
          switch (outputFormat) {
            case 'summary': {
              // Generate summary from input text
              const text = Array.isArray(inputText) ? inputText.join('\n\n') : inputText;
              result = await runSummarizer(text, userId);
              
              // Update usage from the summary operation
              usageReport[id] = {
                promptTokens: text.length / 4, // Estimate
                completionTokens: (result?.length || 0) / 4 // Estimate
              };
              break;
            }
            
            case 'rag': {
              // Run RAG query with context and prompt
              const context = Array.isArray(inputText) ? inputText : [inputText];
              result = await runRAGQuery(context, prompt, userId);
              
              // Update usage from the RAG operation
              usageReport[id] = {
                promptTokens: context.join('\n\n').length / 4 + prompt.length / 4, // Estimate
                completionTokens: (result?.length || 0) / 4 // Estimate
              };
              break;
            }
            
            case 'refine': {
              // Run refine operation on initial response
              const text = Array.isArray(inputText) ? inputText.join('\n\n') : inputText;
              result = await runRefineAnswer(text, prompt, userId);
              
              // Update usage from the refine operation
              usageReport[id] = {
                promptTokens: text.length / 4 + prompt.length / 4, // Estimate
                completionTokens: (result?.length || 0) / 4 // Estimate
              };
              break;
            }
            
            default:
              throw new Error(`Unsupported output format: ${outputFormat}`);
          }
          
          nodeResults[id] = result;
          
          // Add to total usage
          usageReport.total.promptTokens += usageReport[id].promptTokens;
          usageReport.total.completionTokens += usageReport[id].completionTokens;
          break;
        }
        
        default:
          throw new Error(`Unsupported node type: ${type}`);
      }
    }
    
    // Return the result from the output nodes and the usage report
    const outputNodes = sortedNodes.filter(node => node.type === 'output');
    if (outputNodes.length === 0) {
      throw new Error('Pipeline does not contain any output nodes');
    }
    
    const result = outputNodes.map(node => ({
      nodeId: node.id,
      label: node.data.label,
      result: nodeResults[node.id]
    }));
    
    return { result, usageReport };
  } catch (error) {
    // Specific, descriptive error message for debugging
    if (error instanceof Error) {
      throw new Error(`Pipeline execution failed: ${error.message}`);
    }
    
    throw new Error(`Pipeline execution failed: Unknown error`);
  }
}
