'use client';

/**
 * Utility for Azure OpenAI API calls
 * This is a simplified implementation that would be replaced with actual API calls
 */

// Mock pipeline generation data - to be replaced with actual API integration
const samplePipelines = [
  {
    name: "PDF Processing Pipeline",
    nodes: [
      { id: "ds-1", type: "dataSource", position: { x: 100, y: 100 }, data: { type: "dataSource", label: "PDF Loader", settings: { sourceType: "PDF", filepath: "/documents/sample.pdf" } } },
      { id: "ch-1", type: "chunker", position: { x: 100, y: 250 }, data: { type: "chunker", label: "Text Splitter", settings: { chunkSize: 1000, chunkOverlap: 200, splitBy: "token" } } },
      { id: "em-1", type: "embedder", position: { x: 100, y: 400 }, data: { type: "embedder", label: "Embeddings", settings: { model: "text-embedding-ada-002", dimensions: 1536 } } },
      { id: "ix-1", type: "indexer", position: { x: 100, y: 550 }, data: { type: "indexer", label: "Firestore Vector Store", settings: { vectorStore: "Firestore", collectionName: "pdf-embeddings" } } },
      { id: "re-1", type: "retriever", position: { x: 400, y: 400 }, data: { type: "retriever", label: "Retriever", settings: { topK: 5, scoreThreshold: 0.75 } } },
      { id: "op-1", type: "output", position: { x: 400, y: 550 }, data: { type: "output", label: "Results Formatter", settings: { outputFormat: "JSON", includeMetadata: true } } }
    ],
    edges: [
      { id: "e1-2", source: "ds-1", target: "ch-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e2-3", source: "ch-1", target: "em-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e3-4", source: "em-1", target: "ix-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e4-5", source: "ix-1", target: "re-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e5-6", source: "re-1", target: "op-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } }
    ]
  },
  {
    name: "Website Scraping Pipeline",
    nodes: [
      { id: "ds-1", type: "dataSource", position: { x: 100, y: 100 }, data: { type: "dataSource", label: "URL Loader", settings: { sourceType: "Website URL", filepath: "https://example.com" } } },
      { id: "ch-1", type: "chunker", position: { x: 100, y: 250 }, data: { type: "chunker", label: "HTML Splitter", settings: { chunkSize: 1500, chunkOverlap: 300, splitBy: "paragraph" } } },
      { id: "em-1", type: "embedder", position: { x: 400, y: 250 }, data: { type: "embedder", label: "Embeddings", settings: { model: "text-embedding-3-small", dimensions: 1536 } } },
      { id: "ix-1", type: "indexer", position: { x: 400, y: 400 }, data: { type: "indexer", label: "FAISS Store", settings: { vectorStore: "FAISS (in-memory)", collectionName: "web-scrape" } } },
      { id: "op-1", type: "output", position: { x: 700, y: 400 }, data: { type: "output", label: "Markdown Output", settings: { outputFormat: "Markdown", includeMetadata: true } } }
    ],
    edges: [
      { id: "e1-2", source: "ds-1", target: "ch-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e2-3", source: "ch-1", target: "em-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e3-4", source: "em-1", target: "ix-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } },
      { id: "e4-5", source: "ix-1", target: "op-1", type: "smoothstep", animated: true, style: { stroke: "#2563eb", strokeWidth: 2 } }
    ]
  }
];

/**
 * Simulates generating a pipeline from a natural language prompt
 * In production, this would make an actual call to Azure OpenAI
 * @param prompt The user's natural language description of the pipeline
 * @returns A promise that resolves to a pipeline definition
 */
export async function generatePipelineFromPrompt(prompt: string): Promise<{
  nodes: any[]; 
  edges: any[];
  explanation: string;
}> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Pick a random sample pipeline
  const randomPipeline = samplePipelines[Math.floor(Math.random() * samplePipelines.length)];
  
  // Generate explanation based on the prompt and chosen pipeline
  const explanation = `Based on your request: "${prompt}", I've created a ${randomPipeline.name.toLowerCase()}.

This pipeline:
1. Loads data from ${randomPipeline.nodes[0].data.settings.sourceType}
2. Chunks the content into manageable pieces
3. Creates embeddings using ${randomPipeline.nodes.find((n: any) => n.type === 'embedder')?.data.settings.model || 'an embedding model'}
4. Stores vectors in ${randomPipeline.nodes.find((n: any) => n.type === 'indexer')?.data.settings.vectorStore || 'a vector database'}
${randomPipeline.nodes.find((n: any) => n.type === 'retriever') ? '5. Retrieves relevant content based on queries' : ''}
${randomPipeline.nodes.find((n: any) => n.type === 'output') ? `6. Formats output as ${randomPipeline.nodes.find((n: any) => n.type === 'output')?.data.settings.outputFormat}` : ''}

You can customize any of these components by clicking on them.`;
  
  return {
    nodes: randomPipeline.nodes,
    edges: randomPipeline.edges,
    explanation: explanation
  };
}

/**
 * Checks if API key is valid
 * In production this would verify with the actual API
 * @param apiKey The API key to check
 * @returns Whether the API key is valid
 */
export function isApiKeyValid(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simple validation: Check if key is not empty and at least 10 chars
      resolve(apiKey.length >= 10);
    }, 500);
  });
}
