import { 
  ConversationSession, 
  ConversationMessage, 
  ConversationStep, 
  PipelineConfig,
  ConversationStepConfig 
} from '@/types/conversation';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';

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
        return { isValid: false, error: "Please specify how many documents to retrieve (e.g., 'top-5')." };
      }
      
      const topK = parseInt(topKMatch[1] || topKMatch[2]);
      const searchType = searchTypeMatch ? searchTypeMatch[1].toLowerCase() : 'semantic';
      
      if (topK < 1 || topK > 20) {
        return { isValid: false, error: "Number of documents should be between 1 and 20." };
      }
      
      return { isValid: true, parsedValue: { topK, searchType } };
    },
    nextStep: 'rag_config',
    examples: ['top-5 semantic search', '10 documents with hybrid search', 'top-3 keyword search']
  },
  rag_config: {
    step: 'rag_config',
    question: "Finally, which language model would you like to use for generating responses? (gpt-3.5-turbo, gpt-4, gpt-4-turbo) And do you have a specific prompt template?",
    validation: (answer: string) => {
      const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-35-turbo'];
      const modelMatch = answer.match(/(gpt-[34](?:-turbo)?|gpt-35-turbo)/i);
      
      if (!modelMatch) {
        return { isValid: false, error: `Please specify a model: ${validModels.slice(0, 3).join(', ')}` };
      }
      
      const model = modelMatch[1].toLowerCase();
      const promptTemplate = answer.includes('prompt') ? 
        answer.split(/prompt[:\s]+/i)[1]?.trim() : 
        "Answer the question based on the provided context: {context}\n\nQuestion: {question}";
      
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
    validation: (answer: string) => {
      const isConfirmed = /^(yes|y|ok|sure|export|confirm)/i.test(answer.trim());
      return { isValid: true, parsedValue: isConfirmed };
    },
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

export class ConversationService {
  /**
   * Create a new conversation session
   */
  static async createSession(userId: string): Promise<ConversationSession> {
    const session: Omit<ConversationSession, 'id'> = {
      userId,
      status: 'active',
      currentStep: 'welcome',
      messages: [],
      collectedData: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'conversations'), session);
    return { ...session, id: docRef.id };
  }

  /**
   * Get conversation session by ID
   */
  static async getSession(sessionId: string): Promise<ConversationSession | null> {
    const docRef = doc(db, 'conversations', sessionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp.toDate()
      }))
    } as ConversationSession;
  }

  /**
   * Get active session for user
   */
  static async getActiveSession(userId: string): Promise<ConversationSession | null> {
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp.toDate()
      }))
    } as ConversationSession;
  }

  /**
   * Add message to conversation
   */
  static async addMessage(
    sessionId: string, 
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const newMessage: ConversationMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    session.messages.push(newMessage);
    session.updatedAt = new Date();

    await updateDoc(doc(db, 'conversations', sessionId), {
      messages: session.messages,
      updatedAt: session.updatedAt
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
    if (!session) throw new Error('Session not found');

    const currentStepConfig = CONVERSATION_STEPS[session.currentStep];
    
    // Skip validation for welcome step
    if (session.currentStep === 'welcome') {
      const dataSourceType = this.parseDataSourceType(userInput);
      await this.updateSessionStep(sessionId, 'data_source', { 
        dataSource: { 
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
   * Update session step and collected data
   */
  private static async updateSessionStep(
    sessionId: string, 
    step: ConversationStep, 
    collectedData: PipelineConfig
  ): Promise<void> {
    await updateDoc(doc(db, 'conversations', sessionId), {
      currentStep: step,
      collectedData,
      updatedAt: new Date()
    });
  }

  /**
   * Update collected data based on current step
   */
  private static async updateCollectedData(
    session: ConversationSession, 
    parsedValue: any
  ): Promise<PipelineConfig> {
    const data = { ...session.collectedData };

    switch (session.currentStep) {
      case 'data_source':
        data.dataSource = { 
          ...data.dataSource, 
          type: data.dataSource?.type || 'text',
          location: parsedValue 
        };
        break;
      case 'chunking':
        data.chunking = parsedValue;
        break;
      case 'embedding':
        data.embedding = { model: parsedValue, provider: 'openai' };
        break;
      case 'indexing':
        data.indexing = { backend: parsedValue };
        break;
      case 'retrieval':
        data.retrieval = parsedValue;
        break;
      case 'rag_config':
        data.rag = parsedValue;
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
    await updateDoc(doc(db, 'conversations', sessionId), {
      status: 'completed',
      updatedAt: new Date()
    });
  }

  /**
   * Get conversation step configuration
   */
  static getStepConfig(step: ConversationStep): ConversationStepConfig {
    return CONVERSATION_STEPS[step];
  }
}
