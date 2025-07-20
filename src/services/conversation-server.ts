import { 
  ConversationSession, 
  ConversationMessage, 
  ConversationStep, 
  PipelineConfig,
  ConversationStepConfig 
} from '@/types/conversation';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirestoreAdmin } from '@/lib/firestore-admin';

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
    question: "Great! Now, could you provide more details about your data source location? (e.g., file path, S3 bucket name, URL, etc.)",
    validation: (answer: string) => {
      if (answer.trim().length < 3) {
        return { isValid: false, error: "Please provide a valid data source location." };
      }
      return { isValid: true, parsedValue: answer.trim() };
    },
    nextStep: 'chunking'
  },
  chunking: {
    step: 'chunking',
    question: "How would you like to chunk your documents? Please specify the chunk size in tokens (e.g., 500) and overlap (e.g., 50).",
    validation: (answer: string) => {
      const sizeMatch = answer.match(/(\d+)/);
      const overlapMatch = answer.match(/overlap[:\s]*(\d+)/i) || answer.match(/(\d+)[^\d]*(\d+)/);
      
      if (!sizeMatch) {
        return { isValid: false, error: "Please specify a chunk size (e.g., '500 tokens with 50 overlap')." };
      }
      
      const size = parseInt(sizeMatch[1]);
      const overlap = overlapMatch ? parseInt(overlapMatch[overlapMatch.length - 1]) : 50;
      
      if (size < 100 || size > 2000) {
        return { isValid: false, error: "Chunk size should be between 100 and 2000 tokens." };
      }
      
      return { isValid: true, parsedValue: { size, overlap } };
    },
    nextStep: 'embedding',
    examples: ['500 tokens with 50 overlap', '1000 tokens, 100 overlap', '750 tokens']
  },
  embedding: {
    step: 'embedding',
    question: "Which embedding model would you like to use? (text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large)",
    validation: (answer: string) => {
      const validModels = ['text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'];
      const model = answer.toLowerCase().trim();
      
      const matchedModel = validModels.find(m => m.includes(model) || model.includes(m));
      if (!matchedModel) {
        return { isValid: false, error: `Please choose from: ${validModels.join(', ')}` };
      }
      
      return { isValid: true, parsedValue: matchedModel };
    },
    nextStep: 'indexing'
  },
  indexing: {
    step: 'indexing',
    question: "Where would you like to store your vector index? (Firestore, Pinecone, Weaviate, or Local)",
    validation: (answer: string) => {
      const validBackends = ['firestore', 'pinecone', 'weaviate', 'local'];
      const backend = answer.toLowerCase().trim();
      
      const matchedBackend = validBackends.find(b => b.includes(backend) || backend.includes(b));
      if (!matchedBackend) {
        return { isValid: false, error: `Please choose from: ${validBackends.join(', ')}` };
      }
      
      return { isValid: true, parsedValue: matchedBackend };
    },
    nextStep: 'retrieval'
  },
  retrieval: {
    step: 'retrieval',
    question: "How many documents should be retrieved for each query? (e.g., top-5, top-10) And what search type? (semantic, hybrid, or keyword)",
    validation: (answer: string) => {
      const topKMatch = answer.match(/top[- ]?(\d+)|(\d+)/i);
      const searchTypeMatch = answer.match(/(semantic|hybrid|keyword)/i);
      
      if (!topKMatch) {
        return { isValid: false, error: "Please specify how many documents to retrieve (e.g., top-5)." };
      }
      
      if (!searchTypeMatch) {
        return { isValid: false, error: "Please specify a search type (semantic, hybrid, or keyword)." };
      }
      
      const topK = parseInt(topKMatch[1] || topKMatch[2]);
      const searchType = searchTypeMatch[1].toLowerCase();
      
      return { isValid: true, parsedValue: { topK, searchType } };
    },
    nextStep: 'rag_config',
    examples: ['top-5 semantic search', '10 documents with hybrid search', 'top-3 keyword search']
  },
  rag_config: {
    step: 'rag_config',
    question: "Finally, which language model would you like to use for generating responses? (gpt-3.5-turbo, gpt-4, gpt-4-turbo) And do you have a specific prompt template?",
    validation: (answer: string) => {
      const modelMatch = answer.match(/(gpt-3.5-turbo|gpt-4|gpt-4-turbo)/i);
      
      if (!modelMatch) {
        return { isValid: false, error: "Please specify a valid model (gpt-3.5-turbo, gpt-4, gpt-4-turbo)." };
      }
      
      const model = modelMatch[1].toLowerCase();
      const promptTemplate = answer.replace(model, '').trim() || 
        "Answer the question based on the provided context. If you cannot find the answer in the context, say so.";
      
      return { isValid: true, parsedValue: { model, promptTemplate } };
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
  /**
   * Create a new conversation session
   */
  static async createSession(userId: string): Promise<ConversationSession> {
    const db = getFirestoreAdmin();
    
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
    
    const sessionsRef = db.collection('conversations');
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
  static async getSession(sessionId: string): Promise<ConversationSession | null> {
    const db = getFirestoreAdmin();
    
    const docRef = db.collection('conversations').doc(sessionId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    
    if (!data) {
      return null;
    }
    
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
   * Get active session for user
   */
  static async getActiveSession(userId: string): Promise<ConversationSession | null> {
    const db = getFirestoreAdmin();
    
    const sessionsRef = db.collection('conversations');
    const querySnapshot = await sessionsRef
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    if (!data) {
      return null;
    }
    
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
  static async addMessage(
    sessionId: string, 
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<void> {
    const db = getFirestoreAdmin();
    
    const sessionRef = db.collection('conversations').doc(sessionId);
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const newMessage: ConversationMessage = {
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
  static async processUserInput(
    sessionId: string, 
    userInput: string
  ): Promise<{ nextQuestion: string; isComplete: boolean; error?: string }> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const currentStepConfig = CONVERSATION_STEPS[session.currentStep];
    
    // Special case for welcome step
    if (session.currentStep === 'welcome') {
      const dataSourceType = this.parseDataSourceType(userInput);
      await this.updateCollectedData(session, { type: dataSourceType });
      await this.updateSessionStep(sessionId, 'data_source', {
        ...session.collectedData,
        dataSource: { 
          ...session.collectedData.dataSource, 
          type: dataSourceType,
          location: undefined 
        } 
      });
      return { nextQuestion: CONVERSATION_STEPS.data_source.question, isComplete: false };
    }

    // Validate user input
    const validation = currentStepConfig.validation(userInput);
    if (!validation.isValid) {
      return { nextQuestion: currentStepConfig.question, isComplete: false, error: validation.error };
    }

    // Update collected data based on current step
    const updatedData = await this.updateCollectedData(session, validation.parsedValue);
    
    // Move to next step
    const nextStep = currentStepConfig.nextStep;
    await this.updateSessionStep(sessionId, nextStep, updatedData);

    // Handle special steps
    if (nextStep === 'synthesis') {
      const summary = this.generatePipelineSummary(updatedData);
      return { nextQuestion: summary, isComplete: false };
    }

    if (nextStep === 'export') {
      return { nextQuestion: "Exporting your MCP pipeline...", isComplete: false };
    }

    if (nextStep === 'completed') {
      return { nextQuestion: "Your MCP pipeline has been successfully exported!", isComplete: true };
    }

    return { 
      nextQuestion: CONVERSATION_STEPS[nextStep].question, 
      isComplete: false 
    };
  }

  /**
   * Helper function to sanitize data for Firestore
   * Removes undefined values that Firestore doesn't accept
   */
  private static sanitizeData(obj: unknown): Record<string, unknown> | unknown[] | string | number | boolean | null {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (typeof obj !== 'object') {
      return obj as string | number | boolean;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeData(item));
    }
    
    if (obj !== null) {
      const result: Record<string, unknown> = {};
      
      for (const key in obj) {
        const typedObj = obj as Record<string, unknown>;
        if (typedObj[key] !== undefined) {
          result[key] = this.sanitizeData(typedObj[key]);
        }
      }
      
      return result;
    }
    
    return null;
  }

  /**
   * Update session step and collected data
   */
  private static async updateSessionStep(
    sessionId: string, 
    step: ConversationStep, 
    collectedData: PipelineConfig
  ): Promise<void> {
    const db = getFirestoreAdmin();
    
    // With ignoreUndefinedProperties enabled in Firestore settings,
    // we don't need to manually sanitize the data
    await db.collection('conversations').doc(sessionId).update({
      currentStep: step,
      collectedData,
      updatedAt: Timestamp.fromDate(new Date())
    });
  }

  /**
   * Update collected data based on current step
   */
  private static async updateCollectedData(
    session: ConversationSession, 
    parsedValue: unknown
  ): Promise<PipelineConfig> {
    const data = { ...session.collectedData };

    switch (session.currentStep) {
      case 'data_source':
        data.dataSource = { 
          ...data.dataSource, 
          type: data.dataSource?.type || 'text',
          location: typeof parsedValue === 'string' ? parsedValue : String(parsedValue)
        };
        break;
      case 'chunking':
        if (typeof parsedValue === 'object' && parsedValue !== null &&
            'size' in parsedValue && 'overlap' in parsedValue) {
          const chunking = parsedValue as { size: number; overlap: number };
          data.chunking = {
            size: chunking.size,
            overlap: chunking.overlap,
            strategy: 'token'
          };
        }
        break;
      case 'embedding':
        data.embedding = { 
          model: typeof parsedValue === 'string' ? parsedValue : 'text-embedding-ada-002', 
          provider: 'openai' 
        };
        break;
      case 'indexing':
        if (typeof parsedValue === 'string' && 
            ['firestore', 'pinecone', 'weaviate', 'local'].includes(parsedValue)) {
          data.indexing = { 
            backend: parsedValue as 'firestore' | 'pinecone' | 'weaviate' | 'local' 
          };
        }
        break;
      case 'retrieval':
        if (typeof parsedValue === 'object' && parsedValue !== null &&
            'topK' in parsedValue && 'searchType' in parsedValue) {
          const retrieval = parsedValue as { 
            topK: number; 
            searchType: 'semantic' | 'hybrid' | 'keyword';
            threshold?: number;
          };
          data.retrieval = retrieval;
        }
        break;
      case 'rag_config':
        if (typeof parsedValue === 'object' && parsedValue !== null &&
            'model' in parsedValue) {
          const rag = parsedValue as {
            model: string;
            temperature?: number;
            maxTokens?: number;
            promptTemplate?: string;
          };
          data.rag = rag;
        }
        break;
    }

    return data;
  }

  /**
   * Parse data source type from user input
   */
  private static parseDataSourceType(input: string): 'csv' | 'pdf' | 's3' | 'url' | 'text' {
    const lower = input.toLowerCase();
    if (lower.includes('csv')) return 'csv';
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('s3')) return 's3';
    if (lower.includes('url') || lower.includes('web')) return 'url';
    return 'text';
  }

  /**
   * Generate pipeline summary for user confirmation
   */
  private static generatePipelineSummary(config: PipelineConfig): string {
    return `Here's your MCP pipeline configuration:

• **Data Source**: ${config.dataSource?.type?.toUpperCase()} from ${config.dataSource?.location}
• **Chunking**: ${config.chunking?.size} tokens with ${config.chunking?.overlap} overlap
• **Embedding**: ${config.embedding?.model}
• **Index Storage**: ${config.indexing?.backend}
• **Retrieval**: Top-${config.retrieval?.topK} with ${config.retrieval?.searchType} search
• **RAG Model**: ${config.rag?.model}
• **Prompt Template**: ${config.rag?.promptTemplate?.substring(0, 100)}...

Should I export this MCP pipeline now?`;
  }

  /**
   * Mark session as completed
   */
  static async completeSession(sessionId: string): Promise<void> {
    const db = getFirestoreAdmin();
    await db.collection('conversations').doc(sessionId).update({
      status: 'completed',
      updatedAt: Timestamp.fromDate(new Date())
    });
  }

  /**
   * Get conversation step configuration
   */
  static getStepConfig(step: ConversationStep): ConversationStepConfig {
    return CONVERSATION_STEPS[step];
  }
}
