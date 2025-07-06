import { runEmbedder } from './embeddings';
import { runSummarizer } from './summarizer';
import { runRAGQuery } from './ragQuery';
import { runRefineAnswer } from './refineAnswer';

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

interface UsageReport {
  [nodeId: string]: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Executes a pipeline based on the provided graph and prompt
 * 
 * @param graph The pipeline graph with nodes and edges
 * @param prompt The user prompt to process
 * @returns The result and usage report
 */
export async function executePipeline(graph: Graph, prompt: string) {
  // Store intermediate results and usage
  const nodeResults: Record<string, any> = {};
  const usageReport: UsageReport = {};
  
  // Topologically sort nodes (simplified approach)
  // In a real implementation, you would need a proper topological sort algorithm
  // For now, we'll assume nodes are already in execution order
  const sortedNodes = [...graph.nodes];
  
  try {
    // Process each node in order
    for (const node of sortedNodes) {
      const { id, type, data } = node;
      
      // Get inputs to this node
      const inputEdges = graph.edges.filter(edge => edge.target === id);
      const inputData = inputEdges.map(edge => nodeResults[edge.source]).filter(Boolean);
      
      console.log(`Executing node ${id} (${data.label}) of type ${type}`);
      
      // Execute based on node type
      switch (type) {
        case 'dataSource': {
          // In a real implementation, this would load data from a source
          // For now, we'll just use the prompt as the data source
          nodeResults[id] = prompt;
          usageReport[id] = { promptTokens: 0, completionTokens: 0 };
          break;
        }
          
        case 'chunker': {
          // Split text into chunks
          const inputText = inputData[0] || prompt;
          const chunkSize = data.settings.chunkSize || 1000;
          
          // Simple chunking implementation - in production, use a more sophisticated approach
          const chunks = [];
          for (let i = 0; i < inputText.length; i += chunkSize) {
            chunks.push(inputText.substring(i, i + chunkSize));
          }
          
          nodeResults[id] = chunks;
          usageReport[id] = { promptTokens: 0, completionTokens: 0 };
          break;
        }
          
        case 'embedder': {
          const chunks = inputData[0] || [prompt];
          
          // Track usage for this node
          const startTime = Date.now();
          
          // Run embeddings
          const embeddings = await runEmbedder(Array.isArray(chunks) ? chunks : [chunks]);
          
          nodeResults[id] = embeddings;
          
          // Usage is tracked within runEmbedder function
          // We'll just store placeholder here
          usageReport[id] = { 
            promptTokens: chunks.reduce((acc: number, chunk: string) => acc + chunk.length, 0) / 4, // Rough estimate
            completionTokens: 0
          };
          
          console.log(`Embedding completed in ${Date.now() - startTime}ms`);
          break;
        }
          
        case 'indexer': {
          // In a real implementation, this would index embeddings in a vector store
          // For now, just pass through the embeddings
          nodeResults[id] = inputData[0] || [];
          usageReport[id] = { promptTokens: 0, completionTokens: 0 };
          break;
        }
          
        case 'retriever': {
          // In a real implementation, this would retrieve documents from a vector store
          // For now, just pass through previous data
          nodeResults[id] = inputData[0] || [];
          usageReport[id] = { promptTokens: 0, completionTokens: 0 };
          break;
        }
          
        case 'output': {
          // Depending on the output type, we may want to summarize or answer a question
          const inputText = inputData[0];
          
          if (data.settings.outputFormat === 'summary') {
            const summary = await runSummarizer(Array.isArray(inputText) ? inputText.join(' ') : inputText);
            nodeResults[id] = summary;
          } else if (data.settings.outputFormat === 'rag') {
            // If we have context chunks and a question, run RAG
            const context = Array.isArray(inputText) ? inputText : [inputText];
            const answer = await runRAGQuery(context, prompt);
            nodeResults[id] = answer;
          } else {
            // Default to just passing through the data
            nodeResults[id] = inputText;
          }
          
          break;
        }
      }
    }
    
    // Return the result from the last node and the usage report
    const lastNode = sortedNodes[sortedNodes.length - 1];
    const result = nodeResults[lastNode.id];
    
    return { result, usageReport };
  } catch (error) {
    console.error('Error executing pipeline:', error);
    throw new Error(`Pipeline execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
