import { 
  ConversationSession, 
  ConversationMessage, 
  ConversationStep, 
  PipelineConfig,
  ConversationStepConfig 
} from '@/types/conversation';
import { getFirestore } from '@/lib/firebase-admin';
import { Timestamp, Firestore } from 'firebase-admin/firestore';

// Conversation flow configuration
const CONVERSATION_STEPS: Record<ConversationStep, ConversationStepConfig> = {
  welcome: {
    step: 'welcome',
    question: "Hi! Let's build your MCP pipeline step by step. First, what type of data source do you want to ingest? (CSV, PDF, S3, URL, or plain text)",
    validation: () => ({ isValid: true }),
    nextStep: 'data_source',
    examples: ['CSV file from my computer', 'PDF documents from S3', 'Web pages from URLs']
  },
  data_source: {
    step: 'data_source',
    question: "Great! Please provide details about your data source.",
    validation: (answer: string) => {
      if (answer.length < 3) {
        return { isValid: false, error: 'Please provide more details about your data source.' };
      }
      return { isValid: true };
    },
    nextStep: 'chunking'
  },
  chunking: {
    step: 'chunking',
    question: "How would you like to chunk your documents? Please specify the chunk size in tokens (e.g., 500) and overlap (e.g., 50).",
    validation: (answer: string) => {
      const sizeMatch = answer.match(/(\d+)\s*tokens?/i);
      const overlapMatch = answer.match(/(\d+)\s*overlap/i);
      
      if (!sizeMatch) {
        return { 
          isValid: false, 
          error: 'Please specify a chunk size in tokens (e.g., 500 tokens).' 
        };
      }
      
      const size = parseInt(sizeMatch[1]);
      const overlap = overlapMatch ? parseInt(overlapMatch[1]) : 0;
      
      if (size < 100 || size > 8000) {
        return { isValid: false, error: 'Chunk size should be between 100 and 8000 tokens.' };
      }
      
      return { isValid: true, parsedValue: { size, overlap } };
    },
    nextStep: 'embedding',
    examples: ['500 tokens with 50 overlap', '1000 tokens, 100 overlap', '750 tokens']
  },
  embedding: {
    step: 'embedding',
    question: "Which embedding model would you like to use? (e.g., OpenAI, Azure, Cohere)",
    validation: (answer: string) => {
      const lowerAnswer = answer.toLowerCase();
      let provider = '';
      let model = '';
      
      if (lowerAnswer.includes('openai') || lowerAnswer.includes('ada')) {
        provider = 'openai';
        model = 'text-embedding-ada-002';
      } else if (lowerAnswer.includes('azure')) {
        provider = 'azure';
        model = 'text-embedding-ada-002';
      } else if (lowerAnswer.includes('cohere')) {
        provider = 'cohere';
        model = 'embed-english-v3.0';
      } else {
        return { isValid: false, error: 'Please specify a supported embedding provider (OpenAI, Azure, or Cohere).' };
      }
      
      return { isValid: true, parsedValue: { provider, model } };
    },
    nextStep: 'indexing'
  },
  indexing: {
    step: 'indexing',
    question: "Where would you like to store your vector index? (Firestore, Pinecone, Weaviate, or Local)",
    validation: (answer: string) => {
      const lowerAnswer = answer.toLowerCase();
      let backend = '';
      
      if (lowerAnswer.includes('firestore')) {
        backend = 'firestore';
      } else if (lowerAnswer.includes('pinecone')) {
        backend = 'pinecone';
      } else if (lowerAnswer.includes('weaviate')) {
        backend = 'weaviate';
      } else if (lowerAnswer.includes('local')) {
        backend = 'local';
      } else {
        return { isValid: false, error: 'Please specify a supported vector store (Firestore, Pinecone, Weaviate, or Local).' };
      }
      
      return { isValid: true, parsedValue: { backend } };
    },
    nextStep: 'retrieval'
  },
  retrieval: {
    step: 'retrieval',
    question: "How many documents should be retrieved for each query? (e.g., top-5, top-10) And what search type? (semantic, hybrid, or keyword)",
    validation: (answer: string) => {
      const topKMatch = answer.match(/top[- ]?(\d+)/i) || answer.match(/(\d+)\s*documents?/i);
      let searchType = '';
      
      if (!topKMatch) {
        return { isValid: false, error: 'Please specify how many documents to retrieve (e.g., top-5).' };
      }
      
      const topK = parseInt(topKMatch[1]);
      
      if (topK < 1 || topK > 20) {
        return { isValid: false, error: 'Number of documents should be between 1 and 20.' };
      }
      
      if (answer.toLowerCase().includes('semantic')) {
        searchType = 'semantic';
      } else if (answer.toLowerCase().includes('hybrid')) {
        searchType = 'hybrid';
      } else if (answer.toLowerCase().includes('keyword')) {
        searchType = 'keyword';
      } else {
        return { isValid: false, error: 'Please specify a search type (semantic, hybrid, or keyword).' };
      }
      
      return { isValid: true, parsedValue: { topK, searchType } };
    },
    nextStep: 'rag_config',
    examples: ['top-5 semantic search', '10 documents with hybrid search', 'top-3 keyword search']
  },
  rag_config: {
    step: 'rag_config',
    question: "Which LLM would you like to use for RAG? (e.g., GPT-4, Claude, Llama)",
    validation: (answer: string) => {
      const lowerAnswer = answer.toLowerCase();
      let model = '';
      
      if (lowerAnswer.includes('gpt-4') || lowerAnswer.includes('gpt4')) {
        model = 'gpt-4';
      } else if (lowerAnswer.includes('gpt-3.5') || lowerAnswer.includes('gpt3.5')) {
        model = 'gpt-3.5-turbo';
      } else if (lowerAnswer.includes('claude')) {
        model = 'claude-3-opus';
      } else if (lowerAnswer.includes('llama')) {
        model = 'llama-3';
      } else {
        return { isValid: false, error: 'Please specify a supported LLM (GPT-4, GPT-3.5, Claude, or Llama).' };
      }
      
      return { isValid: true, parsedValue: { model, promptTemplate: '' } };
    },
    nextStep: 'synthesis'
  },
  synthesis: {
    step: 'synthesis',
    question: "",
    validation: () => ({ isValid: true }),
    nextStep: 'confirmation'
  },
  confirmation: {
    step: 'confirmation',
    question: "Should I export this MCP pipeline now?",
    validation: (answer: string) => ({ isValid: true }),
    nextStep: 'export'
  },
  export: {
    step: 'export',
    question: "",
    validation: () => ({ isValid: true }),
    nextStep: 'completed'
  },
  completed: {
    step: 'completed',
    question: "",
    validation: () => ({ isValid: true }),
    nextStep: 'completed'
  }
};

/**
 * Server-side Conversation Service for API routes
 * Uses Firebase Admin SDK instead of client SDK
 */
export class ConversationServerService {
  private db: Promise<Firestore>;
  
  constructor() {
    this.db = getFirestore();
  }
  
  /**
   * Create a new conversation session
   */
  async createSession(userId: string): Promise<ConversationSession> {
    const sessionData: Omit<ConversationSession, 'id'> = {
      userId,
      status: 'active',
      currentStep: 'welcome',
      messages: [],
      collectedData: {
        dataSource: { type: 'text', location: '' },
        chunking: { size: 500, overlap: 50 },
        embedding: { model: 'text-embedding-ada-002', provider: 'openai' },
        indexing: { backend: 'firestore' },
        retrieval: { topK: 5, searchType: 'semantic' },
        rag: { model: 'gpt-4', promptTemplate: '' }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const firestore = await this.db;
    const sessionsRef = firestore.collection('conversations');
    const docRef = await sessionsRef.add({
      ...sessionData,
      createdAt: Timestamp.fromDate(sessionData.createdAt),
      updatedAt: Timestamp.fromDate(sessionData.updatedAt)
    });
    
    return {
      id: docRef.id,
      ...sessionData
    };
  }
  
  /**
   * Get conversation session by ID
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const firestore = await this.db;
    const docRef = firestore.collection('conversations').doc(sessionId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data?.userId,
      status: data?.status,
      currentStep: data?.currentStep,
      messages: data?.messages || [],
      collectedData: data?.collectedData || {},
      createdAt: data?.createdAt.toDate(),
      updatedAt: data?.updatedAt.toDate()
    };
  }
  
  /**
   * Get active session for user
   */
  async getActiveSession(userId: string): Promise<ConversationSession | null> {
    const firestore = await this.db;
    const sessionsRef = firestore.collection('conversations');
    const snapshot = await sessionsRef
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data.userId,
      status: data.status,
      currentStep: data.currentStep,
      messages: data.messages || [],
      collectedData: data.collectedData || {},
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    };
  }
  
  /**
   * Add message to conversation
   */
  async addMessage(
    sessionId: string, 
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<void> {
    const firestore = await this.db;
    const sessionRef = firestore.collection('conversations').doc(sessionId);
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const newMessage = {
      id: `msg_${Date.now()}`,
      ...message,
      timestamp: new Date()
    };
    
    const messages = [...session.messages, newMessage];
    
    await sessionRef.update({
      messages,
      updatedAt: Timestamp.fromDate(new Date())
    });
  }
  
  /**
   * Process user input and generate next question
   */
  async processUserInput(
    sessionId: string, 
    userInput: string
  ): Promise<{ nextQuestion: string; isComplete: boolean; error?: string }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return { nextQuestion: '', isComplete: false, error: 'Session not found' };
    }
    
    if (session.status && session.status !== 'active') {
      return { nextQuestion: '', isComplete: true };
    }
    
    const currentStep = session.currentStep;
    const stepConfig = this.getStepConfig(currentStep);
    
    // Validate user input
    const validationResult = stepConfig.validation(userInput);
    
    if (!validationResult.isValid) {
      return { 
        nextQuestion: stepConfig.question, 
        isComplete: false, 
        error: validationResult.error 
      };
    }
    
    // Update collected data based on current step
    const updatedData = await this.updateCollectedData(session, validationResult.parsedValue);
    
    // Move to next step
    const nextStep = stepConfig.nextStep;
    await this.updateSessionStep(sessionId, nextStep, updatedData);
    
    // Get next question
    const nextStepConfig = this.getStepConfig(nextStep);
    let nextQuestion = nextStepConfig.question;
    
    // Special case for synthesis step
    if (nextStep === 'synthesis') {
      nextQuestion = this.generatePipelineSummary(updatedData);
    }
    
    // Special case for export step
    if (nextStep === 'export') {
      await this.completeSession(sessionId);
      nextQuestion = "Your MCP pipeline has been exported successfully!";
    }
    
    return { 
      nextQuestion, 
      isComplete: nextStep === 'completed' || nextStep === 'export'
    };
  }
  
  /**
   * Update session step and collected data
   */
  async updateSessionStep(
    sessionId: string, 
    step: ConversationStep, 
    collectedData: PipelineConfig
  ): Promise<void> {
    const firestore = await this.db;
    await firestore.collection('conversations').doc(sessionId).update({
      currentStep: step,
      collectedData,
      updatedAt: Timestamp.fromDate(new Date())
    });
  }
  
  /**
   * Update collected data based on current step
   */
  async updateCollectedData(
    session: ConversationSession, 
    parsedValue: any
  ): Promise<PipelineConfig> {
    const currentStep = session.currentStep;
    const data = { ...session.collectedData };
    
    switch (currentStep) {
      case 'data_source':
        data.dataSource = {
          ...data.dataSource,
          type: this.parseDataSourceType(parsedValue || ''),
          location: parsedValue || ''
        };
        break;
      case 'chunking':
        data.chunking = parsedValue || data.chunking;
        break;
      case 'embedding':
        data.embedding = parsedValue || data.embedding;
        break;
      case 'indexing':
        data.indexing = parsedValue || data.indexing;
        break;
      case 'retrieval':
        data.retrieval = parsedValue || data.retrieval;
        break;
      case 'rag_config':
        data.rag = parsedValue || data.rag;
        break;
    }
    
    return data;
  }
  
  /**
   * Parse data source type from user input
   */
  parseDataSourceType(input: string): 'csv' | 'pdf' | 's3' | 'url' | 'text' {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('csv')) {
      return 'csv';
    } else if (lowerInput.includes('pdf')) {
      return 'pdf';
    } else if (lowerInput.includes('s3')) {
      return 's3';
    } else if (lowerInput.includes('url')) {
      return 'url';
    } else {
      return 'text';
    }
  }
  
  /**
   * Generate pipeline summary for user confirmation
   */
  generatePipelineSummary(config: PipelineConfig): string {
    return `
Here's a summary of your MCP pipeline:

Data Source: ${config.dataSource?.type?.toUpperCase() || 'TEXT'}
Chunking: ${config.chunking?.size ?? 'N/A'} tokens with ${config.chunking?.overlap ?? 0} overlap
Embedding: ${config.embedding?.model || 'N/A'} (${config.embedding?.provider || 'openai'})
Vector Store: ${config.indexing?.backend || 'firestore'}
Retrieval: Top-${config.retrieval?.topK ?? 5} ${config.retrieval?.searchType || 'semantic'} search
RAG Model: ${config.rag?.model || 'gpt-4'}

Does this look correct? Type 'yes' to export, or 'no' to start over.
    `.trim();
  }
  
  /**
   * Mark session as completed
   */
  async completeSession(sessionId: string): Promise<void> {
    const firestore = await this.db;
    await firestore.collection('conversations').doc(sessionId).update({
      status: 'completed',
      updatedAt: Timestamp.fromDate(new Date())
    });
  }
  
  /**
   * Get conversation step configuration
   */
  getStepConfig(step: ConversationStep): ConversationStepConfig {
    return CONVERSATION_STEPS[step];
  }
}
