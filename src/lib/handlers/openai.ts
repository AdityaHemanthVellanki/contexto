import { client, modelMapping } from '@/lib/azureOpenAI';

/**
 * Interface for usage reporting
 */
export interface UsageReport {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  operation: string;
}

/**
 * Options for embedding text
 */
interface EmbedderOptions {
  dimensions?: number;
  user?: string;
}

/**
 * Run embeddings on text content
 */
export const runEmbedder = async (
  input: string | string[], 
  options: EmbedderOptions = {}
): Promise<{ embeddings: number[][], usage: UsageReport }> => {
  try {
    if (!client) {
      throw new Error('Azure OpenAI client not available');
    }

    // In Azure OpenAI we need to use the model ID as the parameter name
    const response = await client.embeddings.create({
      model: modelMapping.embed,
      input,
      dimensions: options.dimensions,
      user: options.user
    });

    if (!response.usage) {
      throw new Error('No usage information returned from embeddings API');
    }

    return {
      embeddings: response.data.map(item => item.embedding),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: response.usage.total_tokens,
        model: modelMapping.embed,
        operation: 'embedding'
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error in runEmbedder';
    console.error('Embedding error:', error);
    throw new Error(`Failed to generate embeddings: ${message}`);
  }
};

/**
 * Options for summarizing text
 */
interface SummarizerOptions {
  maxTokens?: number;
  temperature?: number;
  user?: string;
}

/**
 * Run summarization on text content
 */
export const runSummarizer = async (
  content: string,
  options: SummarizerOptions = {}
): Promise<{ summary: string, usage: UsageReport }> => {
  try {
    if (!client) {
      throw new Error('Azure OpenAI client not available');
    }

    // Use appropriate model based on content size
    const model = content.length > 16000 ? modelMapping.omni : modelMapping.turbo;

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an AI summarizer. Provide a concise summary of the following text.'
        },
        {
          role: 'user',
          content
        }
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
      user: options.user
    });

    if (!response.usage) {
      throw new Error('No usage information returned from summarization API');
    }

    return {
      summary: response.choices[0].message.content || '',
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        model,
        operation: 'summarization'
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error in runSummarizer';
    console.error('Summarization error:', error);
    throw new Error(`Failed to generate summary: ${message}`);
  }
};

/**
 * Options for RAG queries
 */
interface RAGQueryOptions {
  context?: string[];
  maxTokens?: number;
  temperature?: number;
  user?: string;
}

/**
 * Run RAG query using context and query
 */
export const runRAGQuery = async (
  query: string,
  options: RAGQueryOptions = {}
): Promise<{ answer: string, usage: UsageReport }> => {
  try {
    if (!client) {
      throw new Error('Azure OpenAI client not available');
    }

    // Build context string if provided
    let contextString = '';
    if (options.context && options.context.length > 0) {
      contextString = 'Context information:\n' + options.context.join('\n\n');
    }

    // Determine if we need the larger context model
    const totalInputLength = query.length + (contextString ? contextString.length : 0);
    const model = totalInputLength > 16000 ? modelMapping.omni : modelMapping.turbo;

    // Need to properly type the messages for OpenAI API
    type MessageRole = 'system' | 'user' | 'assistant';
    
    interface ChatMessage {
      role: MessageRole;
      content: string;
    }
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that answers questions based on the provided context.'
      }
    ];

    // Add context if available
    if (contextString) {
      messages.push({
        role: 'user',
        content: contextString
      });
      messages.push({
        role: 'assistant',
        content: 'I will use this context to answer your question.'
      });
    }

    // Add the query
    messages.push({
      role: 'user',
      content: query
    });

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
      user: options.user
    });

    if (!response.usage) {
      throw new Error('No usage information returned from RAG query API');
    }

    return {
      answer: response.choices[0].message.content || '',
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        model,
        operation: 'rag_query'
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error in runRAGQuery';
    console.error('RAG query error:', error);
    throw new Error(`Failed to generate RAG answer: ${message}`);
  }
};

/**
 * Options for answer refinement
 */
interface RefineAnswerOptions {
  maxTokens?: number;
  temperature?: number;
  user?: string;
}

/**
 * Refine an existing answer for improved quality
 */
export const runRefineAnswer = async (
  query: string,
  initialAnswer: string,
  options: RefineAnswerOptions = {}
): Promise<{ refinedAnswer: string, usage: UsageReport }> => {
  try {
    if (!client) {
      throw new Error('Azure OpenAI client not available');
    }

    // Use GPT-4 for refinement
    const model = modelMapping.refine;
    
    // Define the message type for OpenAI API
    type MessageRole = 'system' | 'user' | 'assistant';
    
    interface ChatMessage {
      role: MessageRole;
      content: string;
    }

    const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert AI assistant that refines answers to make them more accurate, comprehensive, and clear.'
        },
        {
          role: 'user',
          content: `Question: ${query}\n\nInitial Answer: ${initialAnswer}\n\nPlease refine this answer to make it more accurate, clear, and comprehensive.`
        }
    ];
    
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 1500,
      user: options.user
    });

    if (!response.usage) {
      throw new Error('No usage information returned from refine answer API');
    }

    return {
      refinedAnswer: response.choices[0].message.content || initialAnswer,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        model,
        operation: 'refine_answer'
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error in runRefineAnswer';
    console.error('Answer refinement error:', error);
    throw new Error(`Failed to refine answer: ${message}`);
  }
};
