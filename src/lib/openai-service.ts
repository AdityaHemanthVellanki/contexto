import OpenAI from 'openai';
import { PipelineLogger } from './utils/pipeline-logger';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  model: string;
  processingTime: number;
}

export interface CompletionResult {
  response: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  processingTime: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
  totalProcessingTime: number;
  averageTokensPerChunk: number;
}

/**
 * Production-grade OpenAI service with rate limiting, retries, and comprehensive logging
 */
export class OpenAIService {
  private client: OpenAI;
  private logger: PipelineLogger;
  private embeddingModel: string;
  private completionModel: string;
  private requestCount: number = 0;
  private totalTokensUsed: number = 0;

  constructor(
    apiKey: string, 
    embeddingModel: string = 'text-embedding-3-small',
    completionModel: string = 'gpt-4',
    logger?: PipelineLogger
  ) {
    this.client = new OpenAI({ apiKey });
    this.embeddingModel = embeddingModel;
    this.completionModel = completionModel;
    this.logger = logger || new PipelineLogger('OPENAI_SERVICE');
  }

  /**
   * Generate embedding for a single text chunk
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.apiCall('OpenAI', 'embeddings', {
        model: this.embeddingModel,
        textLength: text.length
      });

      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      const embedding = response.data[0].embedding;
      const tokenCount = response.usage.total_tokens;
      const processingTime = Date.now() - startTime;

      this.requestCount++;
      this.totalTokensUsed += tokenCount;

      this.logger.apiResponse('OpenAI', 200, {
        tokens: tokenCount,
        dimensions: embedding.length,
        processingTime: `${processingTime}ms`
      });

      return {
        embedding,
        tokenCount,
        model: this.embeddingModel,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.stageError('Embedding generation failed', error as Error);
      
      // Retry logic for rate limits
      if (error instanceof Error && error.message.includes('rate_limit')) {
        this.logger.warn('Rate limit hit, retrying after delay...');
        await this.delay(1000);
        return this.generateEmbedding(text);
      }
      
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple text chunks in batches
   */
  async generateBatchEmbeddings(texts: string[], batchSize: number = 100): Promise<BatchEmbeddingResult> {
    this.logger.stageHeader('BATCH EMBEDDING GENERATION');
    this.logger.info(`Generating embeddings for ${texts.length} chunks`);
    this.logger.info(`Batch size: ${batchSize}, Model: ${this.embeddingModel}`);

    const startTime = Date.now();
    const embeddings: EmbeddingResult[] = [];
    let totalTokens = 0;

    // Process in batches to respect rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      this.logger.stageProgress(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`);

      try {
        const response = await this.client.embeddings.create({
          model: this.embeddingModel,
          input: batch,
        });

        // Process batch results
        for (let j = 0; j < response.data.length; j++) {
          const embeddingData = response.data[j];
          const result: EmbeddingResult = {
            embedding: embeddingData.embedding,
            tokenCount: Math.floor(response.usage.total_tokens / batch.length), // Approximate per chunk
            model: this.embeddingModel,
            processingTime: 0 // Will be calculated at the end
          };
          embeddings.push(result);
        }

        totalTokens += response.usage.total_tokens;
        this.requestCount++;

        // Rate limiting delay between batches
        if (i + batchSize < texts.length) {
          await this.delay(100); // 100ms delay between batches
        }

      } catch (error) {
        this.logger.stageError(`Batch ${batchNumber} failed`, error as Error);
        
        // Retry individual chunks in the failed batch
        this.logger.warn('Retrying batch chunks individually...');
        for (const text of batch) {
          try {
            const result = await this.generateEmbedding(text);
            embeddings.push(result);
            totalTokens += result.tokenCount;
          } catch (chunkError) {
            this.logger.stageError('Individual chunk embedding failed', chunkError as Error);
            throw chunkError;
          }
        }
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const averageTokensPerChunk = Math.round(totalTokens / texts.length);
    
    this.totalTokensUsed += totalTokens;

    this.logger.stageComplete('Batch embedding generation complete', {
      'Total Chunks': texts.length.toString(),
      'Total Tokens': totalTokens.toLocaleString(),
      'Average Tokens/Chunk': averageTokensPerChunk.toString(),
      'Total Time': `${totalProcessingTime}ms`,
      'Average Time/Chunk': `${Math.round(totalProcessingTime / texts.length)}ms`
    });

    return {
      embeddings,
      totalTokens,
      totalProcessingTime,
      averageTokensPerChunk
    };
  }

  /**
   * Generate completion using GPT model
   */
  async generateCompletion(
    prompt: string, 
    context: string, 
    maxTokens: number = 1000
  ): Promise<CompletionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.apiCall('OpenAI', 'chat/completions', {
        model: this.completionModel,
        promptLength: prompt.length,
        contextLength: context.length,
        maxTokens
      });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that answers questions based on the provided context. Use only the information from the context to answer questions. If the context doesn\'t contain enough information to answer the question, say so clearly.'
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${prompt}`
        }
      ];

      const response = await this.client.chat.completions.create({
        model: this.completionModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const completion = response.choices[0]?.message?.content || '';
      const tokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      };
      const processingTime = Date.now() - startTime;

      this.requestCount++;
      this.totalTokensUsed += tokenUsage.totalTokens;

      this.logger.apiResponse('OpenAI', 200, {
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        processingTime: `${processingTime}ms`
      });

      return {
        response: completion,
        tokenUsage,
        model: this.completionModel,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.stageError('Completion generation failed', error as Error);
      
      // Retry logic for rate limits
      if (error instanceof Error && error.message.includes('rate_limit')) {
        this.logger.warn('Rate limit hit, retrying after delay...');
        await this.delay(2000);
        return this.generateCompletion(prompt, context, maxTokens);
      }
      
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    requestCount: number;
    totalTokensUsed: number;
    embeddingModel: string;
    completionModel: string;
    estimatedCost: number;
  } {
    // Rough cost estimation (as of 2024)
    const embeddingCostPer1K = 0.00002; // $0.00002 per 1K tokens for text-embedding-3-small
    const completionCostPer1K = 0.03; // $0.03 per 1K tokens for GPT-4 (rough estimate)
    
    const estimatedCost = (this.totalTokensUsed / 1000) * embeddingCostPer1K;

    return {
      requestCount: this.requestCount,
      totalTokensUsed: this.totalTokensUsed,
      embeddingModel: this.embeddingModel,
      completionModel: this.completionModel,
      estimatedCost
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default OpenAIService;
