import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, successResponse } from '../../../lib/api-middleware';
import { generateEmbeddings } from '../../../lib/azure-openai';
import { upsertEmbeddings, getOrCreateIndex } from '../../../lib/pinecone-client';
import { r2Client, generateDownloadUrl } from '../../../lib/r2-client';
import { processFileToChunks } from '../../../lib/text-processor';
// Admin Firestore is used instead of client SDK
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { initializeFirebaseAdmin } from '../../../lib/firebase-admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { createEmbeddings } from '../../../lib/embeddings';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { processFile } from '../../../lib/fileProcessor';
import { exportMCPPipeline } from '../../../lib/mcpExporter';
import { authenticateRequest } from '../../../lib/api-auth';

// -------- Timeout/Retry Utilities --------
const MAX_PIPELINE_DURATION_MS = 10 * 60 * 1000; // 10 minutes watchdog
const DEFAULT_STAGE_TIMEOUTS = {
  download: 2 * 60 * 1000, // 2 minutes
  extract: 2 * 60 * 1000,
  chunk: 2 * 60 * 1000,
  embeddings: 5 * 60 * 1000, // can be slow
  index: 3 * 60 * 1000,
  export: 3 * 60 * 1000,
} as const;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(label: string, ms: number, task: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function retry<T>(label: string, attempts: number, task: () => Promise<T>, delayMs = 500, backoff = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const wait = delayMs * Math.pow(backoff, i);
        console.warn(`[${label}] attempt ${i + 1}/${attempts} failed. Retrying in ${wait}ms...`, err);
        await sleep(wait);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed after ${attempts} attempts`);
}

function ms(from: number) {
  return `${Date.now() - from}ms`;
}

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  console.log('Using existing Firebase Admin SDK instance');
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for processPipeline API');
} catch (error) {
  console.error('❌ Firebase initialization failed in processPipeline API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called
}

// R2 bucket name from environment variables
const R2_BUCKET = process.env.CF_R2_BUCKET_NAME || '';

// Tool interface
interface Tool {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
}

// Request schema validation
const ProcessPipelineSchema = z.object({
  fileIds: z.array(z.string()).optional().default([]),
  description: z.string().min(1).max(4000),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
      required: z.boolean()
    }))
  })).optional().default([]),
  autoGenerateTools: z.boolean().optional().default(false),
  name: z.string().optional().default(''),
  mcpId: z.string().optional()
});

type ProcessPipelineRequest = {
  fileIds?: string[];
  description: string;
  tools?: Tool[];
  autoGenerateTools?: boolean;
  name?: string;
  mcpId?: string;
};

/**
 * Download file from R2 storage
 * @param r2Key The R2 key for the file to download
 * @returns Buffer containing the file data
 */
async function downloadFileFromR2(r2Key: string): Promise<Buffer> {
  try {
    const getObjectCommand = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key
    });
    
    if (!r2Client) {
      throw new Error('R2 client not initialized');
    }
    
    const response = await r2Client.send(getObjectCommand);
    const chunks: Uint8Array[] = [];
    
    if (response.Body) {
      const stream = response.Body as any;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } else {
      throw new Error('Empty response body from R2');
    }
  } catch (error) {
    console.error('R2 download error:', error);
    throw new Error('Failed to download file from storage');
  }
}

/**
 * Process text description into chunks for embedding
 * @param description The text description to process
 * @returns Array of text chunks
 */
async function processDescriptionToChunks(description: string): Promise<Array<{
  id: string;
  text: string;
  metadata: {
    fileId: string;
    fileName: string;
    chunkIndex: number;
    totalChunks: number;
  };
}>> {
  try {
    // Convert description string to Buffer
    const buffer = Buffer.from(description, 'utf-8');
    // Process the description text into chunks
    const chunks = await withTimeout('chunk:description', DEFAULT_STAGE_TIMEOUTS.chunk, async () =>
      processFileToChunks(
        buffer,
        'text/plain',
        'description.txt',
        'description-' + uuidv4()
      )
    );
    console.log(`Processed description into ${chunks.length} chunks`);
    return chunks;
  } catch (error) {
    console.error('Error processing description to chunks:', error);
    throw new Error('Failed to process description text');
  }
}

/**
 * Async pipeline processing function
 */
async function processPipelineAsync(
  userId: string,
  pipelineId: string,
  fileDataList: Array<{
    id: string;
    name: string;
    mimeType: string;
    r2Key: string;
    size: number;
  }>,
  description: string,
  tools: Tool[],
  autoGenerateTools: boolean,
  mcpId?: string
): Promise<string> {
  // Watchdog to forcibly fail the pipeline if it runs too long
  let aborted = false;
  const watchdogStart = Date.now();
  const watchdog = setTimeout(async () => {
    try {
      aborted = true;
      console.error(`Watchdog: Pipeline ${pipelineId} exceeded ${MAX_PIPELINE_DURATION_MS}ms. Marking as error.`);
      const adminDb = initializeFirebaseAdmin();
      const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
      await pipelineRef.update({
        status: 'error',
        error: `Processing timed out after ${MAX_PIPELINE_DURATION_MS}ms`,
        updatedAt: FieldValue.serverTimestamp(),
        watchdogTriggeredAt: nowIso(),
      });
    } catch (e) {
      console.warn('Watchdog failed to update Firestore (non-fatal):', e);
    }
  }, MAX_PIPELINE_DURATION_MS);

  try {
    console.log(`Starting pipeline processing for pipeline ${pipelineId}`);
    console.log(`User: ${userId}, Files: ${fileDataList.length}, Description length: ${description.length}`);
    
    // Get Firestore reference
    const adminDb = initializeFirebaseAdmin();
    const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
    
    // Update status to processing
    await pipelineRef.update({
      status: 'processing',
      stage: 'start',
      updatedAt: FieldValue.serverTimestamp(),
      startedAt: FieldValue.serverTimestamp(),
    });
    
    // Track export URL if generated
    let exportDownloadUrl: string | undefined;
    
    // Process all files
    const allChunks: Array<{
      id: string;
      text: string;
      metadata: {
        fileId: string;
        fileName: string;
        chunkIndex: number;
        totalChunks: number;
      };
    }> = [];
    
    // Process description if provided
    if (description && description.trim() !== '') {
      console.log('Processing description text...');
      const t0 = Date.now();
      const descriptionChunks = await processDescriptionToChunks(description);
      allChunks.push(...descriptionChunks);
      await pipelineRef.update({
        descriptionChunksCount: descriptionChunks.length,
        [`stageDurations.descriptionMs`]: Date.now() - t0,
        stage: 'description_chunked',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    // Process each file
    for (const fileData of fileDataList) {
      console.log(`Processing file: ${fileData.name} (${fileData.mimeType})`);
      if (aborted) throw new Error('Pipeline aborted by watchdog');

      const fileStageBase = `files.${fileData.id}`;
      const fileStart = Date.now();
      // Update status to show which file is being processed
      await pipelineRef.update({
        currentFile: fileData.name,
        stage: 'downloading',
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      // Download file from R2
      console.log(`Downloading file from R2: ${fileData.r2Key}`);
      const dlStart = Date.now();
      const fileBuffer = await withTimeout(
        `download ${fileData.name}`,
        DEFAULT_STAGE_TIMEOUTS.download,
        async () => retry(`download ${fileData.name}`, 3, async () => downloadFileFromR2(fileData.r2Key))
      );
      await pipelineRef.update({
        [`${fileStageBase}.downloadMs`]: Date.now() - dlStart,
        stage: 'extracting',
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      // Extract text content
      console.log(`Extracting text from file: ${fileData.name}`);
      const exStart = Date.now();
      const extractedText = await withTimeout(
        `extract ${fileData.name}`,
        DEFAULT_STAGE_TIMEOUTS.extract,
        async () => retry(`extract ${fileData.name}`, 2, async () => processFile(fileBuffer, fileData.mimeType, fileData.name))
      );
      await pipelineRef.update({
        [`${fileStageBase}.extractMs`]: Date.now() - exStart,
        stage: 'chunking',
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      if (!extractedText || extractedText.trim() === '') {
        console.warn(`No text content extracted from file: ${fileData.name}`);
        continue;
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters from ${fileData.name}`);
      
      // Process text into chunks
      const textBuffer = Buffer.from(extractedText, 'utf-8');
      // IMPORTANT: We've already extracted plain text above. When chunking, treat it as 'text/plain'
      // to avoid attempting to re-parse the text as the original binary type (e.g., PDF), which can hang.
      const chStart = Date.now();
      const fileChunks = await withTimeout(
        `chunk ${fileData.name}`,
        DEFAULT_STAGE_TIMEOUTS.chunk,
        async () => processFileToChunks(
          textBuffer,
          'text/plain',
          fileData.name,
          fileData.id
        )
      );
      console.log(`Processed ${fileData.name} into ${fileChunks.length} chunks`);
      
      // Add chunks to the collection
      allChunks.push(...fileChunks);
      
      // Update progress in Firestore
      await pipelineRef.update({
        [`fileChunks.${fileData.id}`]: fileChunks.length,
        [`${fileStageBase}.chunkMs`]: Date.now() - chStart,
        [`${fileStageBase}.totalMs`]: Date.now() - fileStart,
        stage: 'file_done',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    // Generate embeddings for all chunks
    console.log(`Generating embeddings for ${allChunks.length} chunks`);
    await pipelineRef.update({
      status: 'embedding',
      stage: 'embeddings',
      chunksCount: allChunks.length,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Extract text from chunks for embedding
    const chunkTexts = allChunks.map(chunk => chunk.text);
    const embStart = Date.now();
    const embeddings = await withTimeout('embeddings', DEFAULT_STAGE_TIMEOUTS.embeddings, async () =>
      retry('embeddings', 2, async () => createEmbeddings(chunkTexts, pipelineId), 1000)
    );
    console.log(`Generated ${embeddings.length} embeddings`);
    
    // Store embeddings in vector database (use namespaces to partition data per user)
    console.log('Storing embeddings in vector database...');
    await pipelineRef.update({
      status: 'indexing',
      stage: 'indexing',
      [`stageDurations.embeddingsMs`]: Date.now() - embStart,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Ensure Pinecone index exists and is ready (unified naming via client)
    const idxStart = Date.now();
    const indexName = await withTimeout('getOrCreateIndex', DEFAULT_STAGE_TIMEOUTS.index, async () =>
      retry('getOrCreateIndex', 2, async () => getOrCreateIndex(userId, pipelineId), 1000)
    );
    // Namespace by user to keep data partitioned within a shared index
    const namespace = userId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 45);
    
    // Convert chunks and embeddings to the format expected by upsertEmbeddings
    // createEmbeddings returns array of {embedding: number[]} objects
    const records = allChunks.map((chunk, i) => ({
      id: `chunk-${i}`,
      values: embeddings[i].embedding, // Extract the actual number[] from the embedding object
      metadata: {
        text: chunk.text,
        fileId: chunk.metadata.fileId,
        fileName: chunk.metadata.fileName,
        pipelineId: pipelineId
      }
    }));
    
    const upStart = Date.now();
    await withTimeout('upsertEmbeddings', DEFAULT_STAGE_TIMEOUTS.index, async () =>
      retry('upsertEmbeddings', 2, async () => upsertEmbeddings(indexName, records, namespace), 1500)
    );
    await pipelineRef.update({
      [`stageDurations.indexMs`]: Date.now() - idxStart,
      [`stageDurations.upsertMs`]: Date.now() - upStart,
      updatedAt: FieldValue.serverTimestamp(),
      indexName,
      namespace
    });
    
    // Generate tools if requested
    if (autoGenerateTools) {
      console.log('Auto-generating tools based on content...');
      // This would be implemented in a real system
      // For now, we'll just update the status
      await pipelineRef.update({
        status: 'generating_tools',
        stage: 'generating_tools',
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // In a real implementation, we would generate tools here
      // and update the tools array in the pipeline document
    }
    
    // Export MCP pipeline if needed
    if (tools && tools.length > 0) {
      console.log('Exporting MCP pipeline...');
      await pipelineRef.update({
        status: 'exporting',
        stage: 'exporting',
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // Create a pipeline object that matches the expected Pipeline type
      const pipelineData = {
        id: pipelineId,
        metadata: {
          author: userId,
          createdAt: new Date().toISOString(),
          fileName: fileDataList.length > 0 ? fileDataList[0].name : 'description',
          fileType: fileDataList.length > 0 ? fileDataList[0].mimeType : 'text/plain',
          purpose: description.substring(0, 100),
          vectorStore: 'pinecone',
          chunksCount: allChunks.length,
          chunkSize: 500,
          overlap: 50
        },
        nodes: [
          {
            id: 'datasource',
            type: 'DataSource',
            data: {
              fileName: fileDataList.length > 0 ? fileDataList[0].name : 'description',
              fileType: fileDataList.length > 0 ? fileDataList[0].mimeType : 'text/plain',
              fileSize: fileDataList.length > 0 ? fileDataList[0].size : description.length
            }
          },
          {
            id: 'chunker',
            type: 'Chunker',
            data: {
              chunkSize: 500,
              overlap: 50,
              chunksCount: allChunks.length
            }
          },
          {
            id: 'embedder',
            type: 'Embedder',
            data: {
              model: 'text-embedding-ada-002',
              dimensions: embeddings[0]?.embedding.length || 1536
            }
          },
          {
            id: 'indexer',
            type: 'Indexer',
            data: {
              vectorStore: 'pinecone',
              indexedCount: allChunks.length
            }
          }
        ],
        edges: [
          { id: 'e1', source: 'datasource', target: 'chunker' },
          { id: 'e2', source: 'chunker', target: 'embedder' },
          { id: 'e3', source: 'embedder', target: 'indexer' }
        ]
      };
      
      // Export the pipeline
      const expStart = Date.now();
      exportDownloadUrl = await withTimeout('exportMCPPipeline', DEFAULT_STAGE_TIMEOUTS.export, async () =>
        retry('exportMCPPipeline', 2, async () => exportMCPPipeline(pipelineData, userId), 1000)
      );
      
      // Update with export information
      await pipelineRef.update({
        exportUrl: exportDownloadUrl,
        exportedAt: FieldValue.serverTimestamp(),
        [`stageDurations.exportMs`]: Date.now() - expStart,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    
    // Update pipeline with completion status
    await pipelineRef.update({
      status: 'complete',
      stage: 'complete',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      indexName
    });
    
    // Also update corresponding MCP document if provided
    if (mcpId) {
      // Top-level path used by dashboard: mcps/{mcpId}
      try {
        await adminDb.collection('mcps').doc(mcpId).set({
          status: 'complete',
          updatedAt: FieldValue.serverTimestamp(),
          ...(exportDownloadUrl ? { exportUrl: exportDownloadUrl } : {}),
          indexName,
          namespace
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update MCP completion status (top-level path mcps/{mcpId}):', err);
      }

      // Legacy nested path (for compatibility): mcps/{userId}/user_mcps/{mcpId}
      try {
        await adminDb
          .collection('mcps')
          .doc(userId)
          .collection('user_mcps')
          .doc(mcpId)
          .set({
            status: 'complete',
            updatedAt: FieldValue.serverTimestamp(),
            ...(exportDownloadUrl ? { exportUrl: exportDownloadUrl } : {}),
            indexName,
            namespace
          }, { merge: true });
      } catch (err2) {
        console.warn('Nested MCP completion update skipped or failed (mcps/{userId}/user_mcps/{mcpId}) [non-fatal]:', err2);
      }
    }
    
    console.log(`Pipeline ${pipelineId} processing complete in ${ms(watchdogStart)}`);
    return `Pipeline processing complete. Processed ${allChunks.length} chunks.`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Pipeline processing error: ${errorMessage}`);
    throw error;
  } finally {
    clearTimeout(watchdog);
  }
}

/**
 * POST /api/processPipeline - Process uploaded file through RAG pipeline
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      return errorResponse('Authentication failed', 401);
    }
    
    const userId = authResult.userId;
    
    // Initialize Firestore using our shared module
    const adminDb = initializeFirebaseAdmin();

    // Parse and validate request body
    const requestBody = await request.json();
    
    // Validate request using Zod schema
    const validationResult = ProcessPipelineSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return errorResponse('Invalid request data: ' + validationResult.error.message, 400);
    }
    
    const { fileIds, description, tools: rawTools = [], autoGenerateTools = false, name = '', mcpId } = validationResult.data;
    
    // Ensure tools array matches the Tool interface
    const tools: Tool[] = rawTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.map(param => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required
      }))
    }));
    
    // Create a unique pipeline ID
    const pipelineId = uuidv4();
    
    // Create a document in Firestore to track pipeline progress
    const pipelineRef = adminDb.collection('pipelines').doc(pipelineId);
    await pipelineRef.set({
      id: pipelineId,
      userId,
      fileIds,
      description,
      tools,
      autoGenerateTools,
      name,
      mcpId,
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    // Fetch file metadata for all files
    const fileDataList = [];
    for (const fileId of fileIds) {
      const uploadDoc = await adminDb.collection('uploads').doc(fileId).get();
      
      if (!uploadDoc.exists) {
        return errorResponse(`File not found: ${fileId}`, 404);
      }
      
      const uploadData = uploadDoc.data();
      if (!uploadData || uploadData.userId !== userId) {
        return errorResponse('Unauthorized access to file', 403);
      }
      
      fileDataList.push({
        id: fileId,
        name: uploadData.fileName || uploadData.name,
        mimeType: uploadData.fileType || uploadData.mimeType,
        r2Key: uploadData.r2Key,
        size: uploadData.fileSize || uploadData.size || 0
      });
    }

    // Start async processing
    // Start async processing
    processPipelineAsync(
      userId,
      pipelineId,
      fileDataList,
      description,
      tools,
      autoGenerateTools,
      mcpId
    ).catch((error: unknown) => {
      console.error('Pipeline processing error:', error);
      console.error(`Pipeline ${pipelineId} failed:`, error);
      
      // Update pipeline with error status
      pipelineRef.update({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: FieldValue.serverTimestamp()
      }).catch((err: unknown) => {
        console.error('Failed to update pipeline error status:', err);
      });

      // Update MCP document with error status if available (create if missing)
      if (mcpId) {
        // Top-level path
        adminDb
          .collection('mcps')
          .doc(mcpId)
          .set({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true })
          .catch((err: unknown) => {
            console.error('Failed to update MCP error status (top-level path mcps/{mcpId}):', err);
          });

        // Legacy nested path
        adminDb
          .collection('mcps')
          .doc(userId)
          .collection('user_mcps')
          .doc(mcpId)
          .set({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true })
          .catch((err: unknown) => {
            console.warn('Failed to update nested MCP error status (mcps/{userId}/user_mcps/{mcpId}) [non-fatal]:', err);
          });
      }
    });
    
    // Return immediate response with pipeline ID
    return successResponse({
      pipelineId,
      status: 'processing'
    });

  } catch (error) {
    console.error('Error in processPipeline API:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}
