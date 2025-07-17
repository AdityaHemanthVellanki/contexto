export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    step?: ConversationStep;
    isValid?: boolean;
    error?: string;
  };
}

export interface ConversationSession {
  id: string;
  userId: string;
  status: 'active' | 'completed' | 'exported';
  currentStep: ConversationStep;
  messages: ConversationMessage[];
  collectedData: PipelineConfig;
  generatedPipeline?: any;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStep = 
  | 'welcome'
  | 'data_source'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'retrieval'
  | 'rag_config'
  | 'synthesis'
  | 'confirmation'
  | 'export'
  | 'completed';

export interface PipelineConfig {
  dataSource?: {
    type: 'csv' | 'pdf' | 's3' | 'url' | 'text';
    location?: string;
    bucket?: string;
    path?: string;
  };
  chunking?: {
    size: number;
    overlap: number;
    strategy?: 'token' | 'sentence' | 'paragraph';
  };
  embedding?: {
    model: string;
    dimensions?: number;
    provider?: 'openai' | 'azure' | 'huggingface';
  };
  indexing?: {
    backend: 'firestore' | 'pinecone' | 'weaviate' | 'local';
    config?: Record<string, any>;
  };
  retrieval?: {
    topK: number;
    searchType?: 'semantic' | 'hybrid' | 'keyword';
    threshold?: number;
  };
  rag?: {
    model: string;
    temperature?: number;
    maxTokens?: number;
    promptTemplate?: string;
  };
}

export interface ConversationStepConfig {
  step: ConversationStep;
  question: string;
  validation: (answer: string) => { isValid: boolean; error?: string; parsedValue?: any };
  nextStep: ConversationStep;
  examples?: string[];
}
