import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { PipelineLogger } from '@/lib/utils/pipeline-logger';
import { doc, setDoc, updateDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2-client';
import { v4 as uuidv4 } from 'uuid';
import { FileProcessor } from '@/lib/file-processors';
import { VectorIndexManager, VectorChunk } from '@/lib/vector-index';
import { OpenAIService } from '@/lib/openai-service';
import { DocumentChunker } from '@/lib/services/chunker';

interface MCPCreateRequest {
  fileId: string;
  fileName: string;
  r2Key: string;
  title?: string;
  description?: string;
}

interface MCPMetadata {
  id: string;
  title: string;
  fileName: string;
  description?: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  uploadUrl: string;
  createdAt: any;
  processedAt?: any;
  numChunks?: number;
  embeddingModel: string;
  vectorIndexName?: string;
  error?: string;
  fileMetadata?: {
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
    characterCount: number;
    processingTime: number;
  };
  chunkingStats?: {
    chunkSize: number;
    chunkOverlap: number;
    totalChunks: number;
    averageChunkSize: number;
    processingTime: number;
  };
  embeddingStats?: {
    model: string;
    totalTokens: number;
    averageTokensPerChunk: number;
    processingTime: number;
    estimatedCost: number;
  };
}

/**
 * POST /api/mcp/create - Create MCP from uploaded file with full pipeline processing
 * 
 * Flow:
 * 1. Validate request and file existence in R2
 * 2. Create MCP metadata in Firestore with 'processing' status
 * 3. Download file from R2 (private access)
 * 4. Extract text content (PDF parsing)
 * 5. Chunk text using token-based sliding window
 * 6. Generate embeddings via OpenAI API
 * 7. Store vectors in local vector database
 * 8. Update MCP metadata with completion status
 * 9. Return MCP ID and metadata
 */
export const POST = withAuth(async (req) => {
  const logger = new PipelineLogger('MCP_CREATE');
  let mcpId: string | null = null;
  
  try {
    const body: MCPCreateRequest = await req.json();
    const { fileId, fileName, r2Key, title, description } = body;

    if (!fileId || !fileName || !r2Key) {
      return errorResponse('Missing required fields: fileId, fileName, r2Key');
    }

    // Generate MCP ID
    mcpId = uuidv4();
    logger.info(`Starting MCP creation for file: ${fileName}`);

    // Create initial MCP metadata in Firestore
    const mcpMetadata: MCPMetadata = {
      id: mcpId,
      title: title || fileName,
      fileName,
      description,
      status: 'processing',
      uploadUrl: `r2://contexto/mcp_uploads/${req.userId}/${mcpId}/${fileName}`,
      createdAt: serverTimestamp(),
      embeddingModel: 'text-embedding-3-small'
    };

    const mcpRef = doc(db, 'mcps', req.userId, 'user_mcps', mcpId);
    await setDoc(mcpRef, mcpMetadata);
    logger.info('MCP metadata created in Firestore');

    // Start async processing
    processMCPAsync(req.userId, mcpId, r2Key, fileName, title || fileName, description);

    return successResponse({
      mcpId,
      status: 'processing',
      message: 'MCP creation started. Check status for progress updates.'
    });

  } catch (error) {
    logger.stageError('MCP creation failed', error as Error);
    
    // Update status to error if MCP was created
    if (mcpId) {
      try {
        const mcpRef = doc(db, 'mcps', req.userId, 'user_mcps', mcpId);
        await updateDoc(mcpRef, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          processedAt: serverTimestamp()
        });
      } catch (updateError) {
        logger.stageError('Failed to update MCP error status', updateError as Error);
      }
    }

    return errorResponse('Failed to create MCP', 500);
  }
});

/**
 * Async function to process MCP creation pipeline with comprehensive logging
 */
async function processMCPAsync(
  userId: string,
  mcpId: string,
  r2Key: string,
  fileName: string,
  title: string,
  description?: string
) {
  const log = new PipelineLogger(`MCP_${mcpId.substring(0, 8)}`);
  const startTime = Date.now();
  
  try {
    log.stageHeader('MCP SERVER CREATION PIPELINE');
    log.info(`Creating MCP server for: ${fileName}`);
    log.info(`User: ${userId}, MCP ID: ${mcpId}`);

    // Step 1: Download file from R2 (private access)
    log.stageHeader('FILE DOWNLOAD');
    const fileBuffer = await downloadFileFromR2(r2Key);
    await logToFirestore(userId, mcpId, 'download', {
      message: `✅ File downloaded from R2: ${fileName}`,
      fileSize: fileBuffer.length,
      r2Key
    });

    // Step 2: Process file and extract text
    log.stageHeader('FILE PROCESSING');
    const fileProcessor = new FileProcessor(log);
    const { text: textContent, metadata: fileMetadata } = await fileProcessor.processFile(fileBuffer, fileName);
    
    await logToFirestore(userId, mcpId, 'processing', {
      message: `📄 Text extracted: ${textContent.length} characters`,
      fileMetadata
    });

    // Step 3: Chunk the text
    log.stageHeader('TEXT CHUNKING');
    const chunker = new DocumentChunker(500, 50); // 500 tokens, 50 overlap
    const chunkResult = await chunker.chunkDocument(textContent, mcpId, title);

    const chunkingStats = {
      chunkSize: 500,
      chunkOverlap: 50,
      totalChunks: chunkResult.chunks.length,
      averageChunkSize: Math.round(chunkResult.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunkResult.chunks.length),
      processingTime: chunkResult.processingTime
    };

    await logToFirestore(userId, mcpId, 'chunking', {
      message: `🔪 Chunked into ${chunkResult.chunks.length} segments`,
      chunkingStats
    });

    // Step 4: Generate embeddings
    log.stageHeader('EMBEDDING GENERATION');
    const openaiService = new OpenAIService(
      process.env.OPENAI_API_KEY!,
      'text-embedding-3-small',
      'gpt-4',
      log
    );

    const chunkTexts = chunkResult.chunks.map(chunk => chunk.text);
    const embeddingResult = await openaiService.generateBatchEmbeddings(chunkTexts, 50);

    await logToFirestore(userId, mcpId, 'embedding', {
      message: `🧠 Embedded using OpenAI (${embeddingResult.embeddings.length}x)`,
      embeddingStats: {
        model: 'text-embedding-3-small',
        totalTokens: embeddingResult.totalTokens,
        averageTokensPerChunk: embeddingResult.averageTokensPerChunk,
        processingTime: embeddingResult.totalProcessingTime,
        estimatedCost: (embeddingResult.totalTokens / 1000) * 0.00002
      }
    });

    // Step 5: Create vector chunks and store in index
    log.stageHeader('VECTOR INDEXING');
    const vectorChunks: VectorChunk[] = chunkResult.chunks.map((chunk, index) => ({
      id: `${mcpId}_chunk_${index}`,
      text: chunk.text,
      embedding: embeddingResult.embeddings[index].embedding,
      metadata: {
        docId: mcpId,
        docName: title,
        chunkIndex: index,
        startChar: chunk.metadata.startChar,
        endChar: chunk.metadata.endChar,
        tokenCount: embeddingResult.embeddings[index].tokenCount
      }
    }));

    const vectorManager = VectorIndexManager.getInstance();
    const vectorIndex = vectorManager.getIndex(mcpId);
    await vectorIndex.addChunks(vectorChunks);

    const indexStats = vectorIndex.getStats();
    await logToFirestore(userId, mcpId, 'indexing', {
      message: `📦 Stored in vector index: ${indexStats.totalChunks} chunks`,
      indexStats
    });

    // Step 6: Update MCP metadata with completion
    const totalProcessingTime = Date.now() - startTime;
    const mcpRef = doc(db, 'mcps', userId, 'user_mcps', mcpId);
    await updateDoc(mcpRef, {
      status: 'complete',
      processedAt: serverTimestamp(),
      numChunks: chunkResult.chunks.length,
      vectorIndexName: `mcp-${mcpId}`,
      fileMetadata,
      chunkingStats,
      embeddingStats: {
        model: 'text-embedding-3-small',
        totalTokens: embeddingResult.totalTokens,
        averageTokensPerChunk: embeddingResult.averageTokensPerChunk,
        processingTime: embeddingResult.totalProcessingTime,
        estimatedCost: (embeddingResult.totalTokens / 1000) * 0.00002
      }
    });

    await logToFirestore(userId, mcpId, 'complete', {
      message: `💬 MCP server ready for queries`,
      totalProcessingTime,
      summary: {
        chunks: chunkResult.chunks.length,
        vectors: vectorChunks.length,
        tokens: embeddingResult.totalTokens,
        processingTime: totalProcessingTime
      }
    });

    log.stageComplete('MCP SERVER CREATION COMPLETE', {
      'Total Time': `${totalProcessingTime}ms`,
      'Chunks Created': chunkResult.chunks.length.toString(),
      'Vectors Stored': vectorChunks.length.toString(),
      'Tokens Used': embeddingResult.totalTokens.toLocaleString(),
      'Index Memory': indexStats.memoryUsage
    });

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    log.stageError('MCP server creation failed', error as Error);
    
    await logToFirestore(userId, mcpId, 'error', {
      message: `❌ MCP creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.stack : 'Unknown error',
      processingTime: totalProcessingTime
    });
    
    // Update status to error
    try {
      const mcpRef = doc(db, 'mcps', userId, 'user_mcps', mcpId);
      await updateDoc(mcpRef, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        processedAt: serverTimestamp()
      });
    } catch (updateError) {
      log.stageError('Failed to update MCP error status', updateError as Error);
    }
  }
}

/**
 * Download file from Cloudflare R2 using private access
 */
async function downloadFileFromR2(r2Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.CF_R2_BUCKET_NAME!,
    Key: r2Key
  });

  const response = await r2Client.send(command);
  
  if (!response.Body) {
    throw new Error('File not found in R2 storage');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/**
 * Log processing steps to Firestore subcollection
 */
async function logToFirestore(
  userId: string,
  mcpId: string,
  stage: string,
  data: any
): Promise<void> {
  try {
    const logsRef = collection(db, 'mcps', userId, 'user_mcps', mcpId, 'logs');
    await addDoc(logsRef, {
      stage,
      timestamp: serverTimestamp(),
      ...data
    });
  } catch (error) {
    console.error('Failed to log to Firestore:', error);
  }
}

/**
 * GET /api/mcp/create - Get MCP creation status
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const mcpId = searchParams.get('mcpId');

    if (!mcpId) {
      return errorResponse('Missing mcpId parameter');
    }

    const mcpRef = doc(db, 'mcps', req.userId, 'user_mcps', mcpId);
    const mcpDoc = await getDoc(mcpRef);

    if (!mcpDoc.exists()) {
      return errorResponse('MCP not found', 404);
    }

    const mcpData = mcpDoc.data();
    return successResponse({
      mcp: {
        ...mcpData,
        createdAt: mcpData.createdAt?.toDate?.()?.toISOString() || mcpData.createdAt,
        processedAt: mcpData.processedAt?.toDate?.()?.toISOString() || mcpData.processedAt
      }
    });

  } catch (error) {
    console.error('MCP status retrieval error:', error);
    return errorResponse('Failed to retrieve MCP status', 500);
  }
});
