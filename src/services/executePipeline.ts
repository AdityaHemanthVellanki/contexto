import { runEmbedder, runSummarizer, runRAGQuery, runRefineAnswer, UsageReport as OpenAIUsage } from '@/lib/handlers/openai';
import { logUsage, aggregateUsage } from '@/lib/usage/logUsage';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

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
  totalTokens?: number;
}

export interface UsageReport {
  [nodeId: string]: NodeUsage;
  total: NodeUsage;
}

// Document with embedding for vector storage
export interface EmbeddedDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
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
  
  // Store OpenAI usage for tracking and logging
  const openAIUsage: OpenAIUsage[] = [];
  
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
      usageReport[id] = {
        promptTokens: 0,
        completionTokens: 0
      };
      
      // Process based on node type
      switch (type) {
        case 'dataSource': {
          // For data source, use the provided content
          const sourceType = data.settings.sourceType || 'text';
          
          if (sourceType === 'text') {
            nodeResults[id] = data.settings.content || '';
          } else if (sourceType === 'prompt') {
            nodeResults[id] = prompt;
          } else {
            throw new Error(`Unsupported data source type: ${sourceType}`);
          }
          break;
        }
        
        case 'chunker': {
          // For chunker, split the input text into chunks
          const text = inputData[0];
          if (!text) {
            throw new Error('Chunker received empty input');
          }
          
          const chunkSize = data.settings.chunkSize || 1000;
          const overlap = data.settings.overlap || 0;
          
          // Split text into chunks
          const chunks = [];
          if (typeof text === 'string') {
            // Simple chunking by character count for prototype
            for (let i = 0; i < text.length; i += chunkSize - overlap) {
              chunks.push(text.substring(i, i + chunkSize));
            }
          } else {
            throw new Error('Chunker expects string input');
          }
          
          nodeResults[id] = chunks;
          break;
        }
        
        case 'embedder': {
          // For embedder, convert text chunks into embeddings
          const chunks = inputData[0];
          if (!chunks || !Array.isArray(chunks)) {
            throw new Error('Embedder requires chunks as input');
          }
          
          // Call the Azure OpenAI embeddings API
          const { embeddings, usage } = await runEmbedder(chunks, {
            user: userId // Pass user ID for tracking
          });
          
          // Track usage
          openAIUsage.push(usage);
          usageReport[id] = {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens
          };
          
          // Create documents with text and embeddings
          const documents: EmbeddedDocument[] = chunks.map((chunk, i) => ({
            id: `doc_${i}`,
            text: chunk,
            embedding: embeddings[i]
          }));
          
          nodeResults[id] = documents;
          break;
        }
        
        case 'indexer': {
          // For indexer, organize documents for retrieval
          const documents = inputData[0];
          if (!documents || !Array.isArray(documents)) {
            throw new Error('Indexer requires documents as input');
          }
          
          // In production, this might insert into a vector database
          // For prototype, we just pass through the documents
          const index = documents.map((doc: EmbeddedDocument, i: number) => ({
            id: doc.id || `doc_${i}`,
            text: doc.text,
            embedding: doc.embedding
          }));
          
          nodeResults[id] = index;
          break;
        }
        
        case 'retriever': {
          // For retriever, perform semantic search
          const index = inputData[0];
          if (!index || !Array.isArray(index)) {
            throw new Error('Retriever requires an index as input');
          }
          
          // Get retriever settings
          const queryText = prompt;
          const topK = data.settings.topK || 3;
          
          // In production, this would use embedding to perform semantic search
          // For now, we'll return the first topK documents as a simplified implementation
          const retrievedDocs = index.slice(0, topK).map((item: EmbeddedDocument) => item.text);
          
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
          
          let result: any;
          
          switch (outputFormat) {
            case 'summary': {
              // Generate summary from input text
              const text = Array.isArray(inputText) ? inputText.join('\n\n') : inputText;
              
              // Call the Azure OpenAI summarizer
              const summarizerResult = await runSummarizer(text, {
                user: userId,
                maxTokens: data.settings.maxTokens || 500,
                temperature: data.settings.temperature || 0.3
              });
              
              // Track usage
              openAIUsage.push(summarizerResult.usage);
              usageReport[id] = {
                promptTokens: summarizerResult.usage.promptTokens,
                completionTokens: summarizerResult.usage.completionTokens,
                totalTokens: summarizerResult.usage.totalTokens
              };
              
              result = summarizerResult.summary;
              break;
            }
            
            case 'rag': {
              // Run RAG query with context and prompt
              const context = Array.isArray(inputText) ? inputText : [inputText];
              
              // Call the Azure OpenAI RAG query
              const ragResult = await runRAGQuery(prompt, {
                context,
                user: userId,
                maxTokens: data.settings.maxTokens || 1000,
                temperature: data.settings.temperature || 0.7
              });
              
              // Track usage
              openAIUsage.push(ragResult.usage);
              usageReport[id] = {
                promptTokens: ragResult.usage.promptTokens,
                completionTokens: ragResult.usage.completionTokens,
                totalTokens: ragResult.usage.totalTokens
              };
              
              result = ragResult.answer;
              break;
            }
            
            case 'refine': {
              // Run refine operation on initial response
              const initialAnswer = Array.isArray(inputText) ? inputText.join('\n\n') : inputText;
              
              // Call the Azure OpenAI refine answer
              const refineResult = await runRefineAnswer(prompt, initialAnswer, {
                user: userId,
                maxTokens: data.settings.maxTokens || 1500,
                temperature: data.settings.temperature || 0.5
              });
              
              // Track usage
              openAIUsage.push(refineResult.usage);
              usageReport[id] = {
                promptTokens: refineResult.usage.promptTokens,
                completionTokens: refineResult.usage.completionTokens,
                totalTokens: refineResult.usage.totalTokens
              };
              
              result = refineResult.refinedAnswer;
              break;
            }
            
            default:
              throw new Error(`Unsupported output format: ${outputFormat}`);
          }
          
          nodeResults[id] = result;
          break;
        }
        
        default:
          throw new Error(`Unsupported node type: ${type}`);
      }
      
      // Add to total usage for this node
      if (usageReport[id].promptTokens) {
        usageReport.total.promptTokens += usageReport[id].promptTokens;
      }
      if (usageReport[id].completionTokens) {
        usageReport.total.completionTokens += usageReport[id].completionTokens;
      }
    }
    
    // Log aggregated usage to Firestore
    if (openAIUsage.length > 0) {
      try {
        const aggregatedUsage = aggregateUsage(openAIUsage);
        await logUsage(userId, 'pipeline', aggregatedUsage);
      } catch (logError) {
        console.error('Failed to log usage:', logError);
        // Continue execution despite logging error
      }
    }
    
    // Store pipeline execution result in Firestore
    try {
      await addDoc(collection(db, 'pipelineExecutions'), {
        userId,
        pipelineId: graph.nodes.find(n => n.type === 'output')?.id || 'unknown',
        promptTokens: usageReport.total.promptTokens,
        completionTokens: usageReport.total.completionTokens,
        totalTokens: usageReport.total.promptTokens + usageReport.total.completionTokens,
        timestamp: serverTimestamp()
      });
    } catch (storeError) {
      console.error('Failed to store pipeline execution:', storeError);
      // Continue execution despite storage error
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
