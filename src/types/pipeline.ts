import { z } from 'zod';

// Base node configuration schema
export const NodeConfigSchema = z.object({
  chunkSize: z.number().optional(),
  chunkOverlap: z.number().optional(),
  topK: z.number().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  threshold: z.number().optional(),
  batchSize: z.number().optional(),
  indexName: z.string().optional(),
  dataSourceType: z.enum(['pdf', 'text', 'url', 'api']).optional(),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
});

// Node types enum
export const NodeTypeSchema = z.enum([
  'DataSource',
  'Chunker', 
  'Embedder',
  'Indexer',
  'Retriever',
  'RAG'
]);

// Pipeline node schema
export const PipelineNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.object({
    label: z.string(),
    description: z.string().optional(),
    config: NodeConfigSchema
  })
});

// Pipeline edge schema
export const PipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
  animated: z.boolean().optional()
});

// Complete pipeline schema
export const PipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(PipelineNodeSchema),
  edges: z.array(PipelineEdgeSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string()
});

// Pipeline generation request schema
export const PipelineGenerationRequestSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  userId: z.string().optional()
});

// Pipeline generation response schema
export const PipelineGenerationResponseSchema = z.object({
  pipelineJson: z.object({
    nodes: z.array(PipelineNodeSchema),
    edges: z.array(PipelineEdgeSchema),
    metadata: z.object({
      name: z.string(),
      description: z.string(),
      estimatedComplexity: z.enum(['low', 'medium', 'high']),
      suggestedResources: z.array(z.string()).optional()
    })
  }),
  reasoning: z.string().optional()
});

// Chat message schema
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.object({
    pipelineGenerated: z.boolean().optional(),
    pipelineId: z.string().optional()
  }).optional()
});

// Export TypeScript types
export type NodeConfig = z.infer<typeof NodeConfigSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type PipelineNode = z.infer<typeof PipelineNodeSchema>;
export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>;
export type Pipeline = z.infer<typeof PipelineSchema>;
export type PipelineGenerationRequest = z.infer<typeof PipelineGenerationRequestSchema>;
export type PipelineGenerationResponse = z.infer<typeof PipelineGenerationResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Default node configurations
export const DEFAULT_NODE_CONFIGS: Record<NodeType, NodeConfig> = {
  DataSource: {
    dataSourceType: 'pdf',
    batchSize: 10
  },
  Chunker: {
    chunkSize: 1000,
    chunkOverlap: 200
  },
  Embedder: {
    model: 'text-embedding-ada-002',
    batchSize: 100
  },
  Indexer: {
    indexName: 'default',
    batchSize: 50
  },
  Retriever: {
    topK: 5,
    threshold: 0.7
  },
  RAG: {
    model: 'gpt-35-turbo',
    temperature: 0.3,
    maxTokens: 1000
  }
};

// Node type descriptions
export const NODE_DESCRIPTIONS: Record<NodeType, string> = {
  DataSource: 'Ingests data from various sources (PDFs, text files, URLs, APIs)',
  Chunker: 'Splits documents into smaller, manageable chunks for processing',
  Embedder: 'Converts text chunks into vector embeddings using AI models',
  Indexer: 'Stores and indexes embeddings in a vector database',
  Retriever: 'Searches and retrieves relevant chunks based on queries',
  RAG: 'Generates responses using retrieved context and language models'
};

/**
 * Pipeline execution data
 */
export interface PipelineData {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  steps: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    logs: string[];
  }[];
}
