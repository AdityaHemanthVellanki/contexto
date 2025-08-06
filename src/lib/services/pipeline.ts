import { DocumentChunker, ChunkResult } from './chunker';
import { DocumentEmbedder, EmbeddingResult } from './embedder';
import { VectorDatabase } from './vectordb';
import { DocumentRetriever, RetrievalContext, PromptContext } from './retriever';
import { CompletionService, CompletionResult, CompletionOptions } from './completion';
import { PipelineLogger } from '../utils/pipeline-logger';
import { v4 as uuidv4 } from 'uuid';

export interface PipelineConfig {
  openaiApiKey: string;
  pineconeApiKey: string;
  pineconeEnvironment: string;
  embeddingModel?: string;
  completionModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  maxContextTokens?: number;
}

export interface DocumentInput {
  text: string;
  docId: string;
  docName: string;
}

export interface PipelineResult {
  success: boolean;
  docId: string;
  chunksProcessed: number;
  vectorsStored: number;
  processingTime: number;
  indexName: string;
}

export interface QueryResult {
  response: string;
  sources: Array<{
    docId: string;
    docName: string;
    relevanceScore: number;
    text: string;
  }>;
  processingTime: number;
  tokensUsed: number;
}

export class AIDataPipeline {
  private chunker: DocumentChunker;
  private embedder: DocumentEmbedder;
  private vectorDB!: VectorDatabase;
  private retriever!: DocumentRetriever;
  private completion: CompletionService;
  private config: PipelineConfig;
  private logger: PipelineLogger;
  private pipelineId: string;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.pipelineId = uuidv4().substring(0, 8);
    this.logger = new PipelineLogger(this.pipelineId);

    this.logger.stageHeader('INITIALIZING AI PIPELINE');
    this.logger.info(`Configuration:`);
    this.logger.info(`Embedding Model: ${config.embeddingModel || 'text-embedding-3-small'}`);
    this.logger.info(`Completion Model: ${config.completionModel || 'gpt-4o'}`);
    this.logger.info(`Chunk Size: ${config.chunkSize || 800}`);
    this.logger.info(`Chunk Overlap: ${config.chunkOverlap || 150}`);
    this.logger.info(`Max Context Tokens: ${config.maxContextTokens || 3000}`);

    // Initialize services
    this.chunker = new DocumentChunker(config.chunkSize, config.chunkOverlap);
    this.embedder = new DocumentEmbedder(config.openaiApiKey, config.embeddingModel);
    this.completion = new CompletionService(config.openaiApiKey, config.completionModel);

    this.logger.stageComplete('Initialization', { 
      'Chunker': 'Ready',
      'Embedder': 'Ready',
      'Completion': 'Ready'
    });
  }

  async initializeVectorDB(indexName: string, namespace?: string): Promise<void> {
    this.logger.stageHeader('VECTOR DATABASE INITIALIZATION');
    this.logger.stageProgress(`Initializing vector database: ${indexName}`);
    
    try {
      this.logger.apiCall('Pinecone', 'Initialize', { 
        environment: this.config.pineconeEnvironment,
        indexName: indexName,
        namespace: namespace || 'default'
      });
      
      this.vectorDB = new VectorDatabase(
        this.config.pineconeApiKey,
        this.config.pineconeEnvironment,
        indexName,
        namespace
      );
  
      const modelInfo = this.embedder.getModelInfo();
      await this.vectorDB.ensureIndexExists(modelInfo.dimensions);
  
      this.retriever = new DocumentRetriever(
        this.embedder,
        this.vectorDB,
        this.config.maxContextTokens
      );
  
      this.logger.stageComplete('Vector Database Initialization', {
        'Index': indexName,
        'Namespace': namespace || 'default',
        'Dimensions': modelInfo.dimensions,
        'Status': 'Ready'
      });
    } catch (error) {
      this.logger.stageError('Vector Database Initialization', error);
      throw error;
    }
  }

  async processDocument(document: DocumentInput): Promise<PipelineResult> {
    this.logger.stageHeader('DOCUMENT PROCESSING');
    this.logger.stageProgress(`Processing document: ${document.docName} (ID: ${document.docId})`);
    
    const startTime = Date.now();
    
    try {
      // Step 1: Chunk the document
      this.logger.stageProgress('Chunking document...');
      const chunkResult = await this.chunker.chunkDocument(
        document.text,
        document.docId,
        document.docName
      );
      this.logger.info(`Created ${chunkResult.totalChunks} chunks`);
      
      // Step 2: Generate embeddings for each chunk
      this.logger.stageProgress('Generating embeddings...');
      this.logger.apiCall('Azure OpenAI', 'Embeddings', {
        model: this.config.embeddingModel || 'text-embedding-3-small',
        chunkCount: chunkResult.totalChunks
      });
      
      const embeddingResult = await this.embedder.embedChunks(chunkResult);
      this.logger.info(`Generated ${embeddingResult.totalEmbeddings} embeddings`);
      
      // Step 3: Store vectors in the vector database
      this.logger.stageProgress('Storing vectors in database...');
      
      // Store vectors in the database
      this.logger.apiCall('Pinecone', 'UpsertVectors', {
        vectorCount: embeddingResult.totalEmbeddings,
        dimensions: embeddingResult.embeddings[0]?.dimensions || 0,
        model: embeddingResult.model
      });
      
      await this.vectorDB.upsertVectors(embeddingResult, document.docId);
      
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      this.logger.stageComplete('Document Processing', {
        'Document': document.docName,
        'ID': document.docId,
        'Chunks': chunkResult.totalChunks,
        'Vectors Stored': embeddingResult.totalEmbeddings,
        'Processing Time': `${processingTime.toFixed(2)}s`,
        'Index': this.vectorDB.getIndexName()
      });
      
      return {
        success: true,
        docId: document.docId,
        chunksProcessed: chunkResult.totalChunks,
        vectorsStored: embeddingResult.totalEmbeddings,
        processingTime,
        indexName: this.vectorDB.getIndexName()
      };
    } catch (error: unknown) {
      this.logger.stageError('Document Processing', error);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processMultipleDocuments(documents: DocumentInput[]): Promise<PipelineResult[]> {
    this.logger.stageHeader('BATCH PROCESSING');
    this.logger.info(`Processing ${documents.length} documents`);

    const results: PipelineResult[] = [];
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      this.logger.stageProgress(`Processing document ${i + 1}/${documents.length}: ${doc.docName}`);
      
      try {
        const result = await this.processDocument(doc);
        results.push(result);
      } catch (error) {
        this.logger.stageError(`Document Processing: ${doc.docName}`, error);
        results.push({
          success: false,
          docId: doc.docId,
          chunksProcessed: 0,
          vectorsStored: 0,
          processingTime: 0,
          indexName: this.vectorDB.getIndexName(),
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    this.logger.stageComplete('BATCH PROCESSING', {
      'Total Documents': documents.length,
      'Successfully Processed': successful,
      'Failed': documents.length - successful
    });

    return results;
  }

  async queryDocuments(
    query: string,
    options: {
      topK?: number;
      filter?: Record<string, any>;
      completionOptions?: CompletionOptions;
    } = {}
  ): Promise<QueryResult> {
    this.logger.stageHeader('QUERY PROCESSING');
    this.logger.info(`Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    
    const startTime = Date.now();

    try {
      // Step 1: Retrieval
      this.logger.stageProgress('STEP 1: RETRIEVAL');
      this.logger.apiCall('Pinecone', 'QueryVectors', {
        topK: options.topK || 5,
        filter: options.filter || 'None',
        index: this.vectorDB.getIndexName()
      });
      
      const retrievalContext = await this.retriever.retrieveContext(
        query,
        options.topK || 5,
        options.filter
      );

      // Step 2: Prompt Building
      this.logger.stageProgress('STEP 2: PROMPT BUILDING');
      const promptContext = this.retriever.buildPromptContext(retrievalContext, query);

      // Step 3: Completion
      this.logger.stageProgress('STEP 3: COMPLETION');
      this.logger.apiCall('Azure OpenAI', 'ChatCompletion', {
        model: this.config.completionModel || 'gpt-4o',
        contextLength: JSON.stringify(promptContext).length,
        options: options.completionOptions || {}
      });
      
      const completionResult = await this.completion.generateCompletion(
        promptContext,
        query,
        options.completionOptions
      );

      const processingTime = Date.now() - startTime;

      this.logger.stageComplete('QUERY PROCESSING', {
        'Retrieval': `${retrievalContext.chunks.length} chunks`,
        'Context Length': `${JSON.stringify(promptContext).length} chars`,
        'Response Length': `${completionResult.response.length} chars`,
        'Tokens Used': completionResult.tokensUsed.total,
        'Processing Time': `${processingTime}ms`
      });

      return {
        response: completionResult.response,
        sources: retrievalContext.chunks.map(chunk => ({
          docId: chunk.metadata.docId,
          docName: chunk.metadata.docName,
          relevanceScore: chunk.score,
          text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
        })),
        processingTime,
        tokensUsed: completionResult.tokensUsed.total,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.stageError('QUERY PROCESSING', error);
      this.logger.info(`Failed after: ${processingTime}ms`);

      throw new Error(`Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIndexStats(): Promise<any> {
    this.logger.stageHeader('INDEX STATISTICS');
    
    if (!this.vectorDB) {
      const error = new Error('Vector database not initialized');
      this.logger.stageError('Index Statistics', error);
      throw error;
    }
    
    try {
      this.logger.apiCall('Pinecone', 'GetIndexStats', {
        index: this.vectorDB.getIndexName()
      });
      
      const stats = await this.vectorDB.getIndexStats();
      
      this.logger.stageComplete('Index Statistics', {
        'Index': this.vectorDB.getIndexName(),
        'Vector Count': stats.totalVectorCount || 'Unknown',
        'Namespaces': Object.keys(stats.namespaces || {}).length || 0
      });
      
      return stats;
    } catch (error) {
      this.logger.stageError('Index Statistics', error);
      throw error;
    }
  }

  async deleteDocument(docId: string): Promise<void> {
    this.logger.stageHeader('DOCUMENT DELETION');
    this.logger.stageProgress(`Deleting document: ${docId}`);
    
    if (!this.vectorDB) {
      const error = new Error('Vector database not initialized');
      this.logger.stageError('Document Deletion', error);
      throw error;
    }
    
    try {
      this.logger.apiCall('Pinecone', 'DeleteVectors', {
        docId,
        index: this.vectorDB.getIndexName()
      });
      
      await this.vectorDB.deleteVectors(docId);
      
      this.logger.stageComplete('Document Deletion', {
        'Document ID': docId,
        'Index': this.vectorDB.getIndexName(),
        'Status': 'Deleted'
      });
    } catch (error) {
      this.logger.stageError('Document Deletion', error);
      throw error;
    }
  }
}

export const createPipeline = (config: PipelineConfig) => {
  return new AIDataPipeline(config);
};
