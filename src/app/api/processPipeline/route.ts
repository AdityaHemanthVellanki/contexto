import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { generateEmbeddings } from '@/lib/azure-openai';
import { upsertEmbeddings } from '@/lib/pinecone-client';
import { generateDownloadUrl } from '@/lib/r2-client';
import { processFileToChunks } from '@/lib/text-processor';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Request schema validation
const ProcessPipelineSchema = z.object({
  fileId: z.string().min(1),
  purpose: z.string().min(1).max(1000),
  context: z.string().optional()
});

interface ProcessPipelineRequest {
  fileId: string;
  purpose: string;
  context?: string;
}

/**
 * Download file from R2 storage
 */
async function downloadFileFromR2(r2Key: string): Promise<Buffer> {
  try {
    const downloadUrl = await generateDownloadUrl(r2Key);
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('File download error:', error);
    throw new Error('Failed to download file from storage');
  }
}

/**
 * POST /api/processPipeline - Process uploaded file through RAG pipeline
 */
export const POST = withAuth(async (req) => {
  try {
    const body: ProcessPipelineRequest = await req.json();
    const validation = ProcessPipelineSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const { fileId, purpose, context } = validation.data;
    
    // Get file metadata from Firestore
    const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
    const fileDoc = await getDoc(fileDocRef);
    
    if (!fileDoc.exists()) {
      return errorResponse('File not found', 404);
    }
    
    const fileData = fileDoc.data();
    const { name: fileName, mimeType, r2Key, size } = fileData;
    
    // Generate unique pipeline ID
    const pipelineId = uuidv4();
    
    // Create pipeline record
    const pipelineData = {
      id: pipelineId,
      fileId,
      fileName,
      purpose,
      context: context || '',
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: req.userId,
      progress: {
        downloading: false,
        chunking: false,
        embedding: false,
        indexing: false,
        completed: false
      }
    };
    
    const pipelineDocRef = doc(db, 'users', req.userId, 'pipelines', pipelineId);
    await setDoc(pipelineDocRef, pipelineData);
    
    // Start processing pipeline asynchronously
    processPipelineAsync(req.userId, pipelineId, fileId, fileName, mimeType, r2Key, purpose, context);
    
    return successResponse({
      pipelineId,
      status: 'processing',
      message: 'Pipeline processing started'
    });
  } catch (error) {
    console.error('Pipeline processing error:', error);
    return errorResponse('Failed to start pipeline processing', 500);
  }
});

/**
 * Async pipeline processing function
 */
async function processPipelineAsync(
  userId: string,
  pipelineId: string,
  fileId: string,
  fileName: string,
  mimeType: string,
  r2Key: string,
  purpose: string,
  context?: string
) {
  const pipelineDocRef = doc(db, 'users', userId, 'pipelines', pipelineId);
  
  try {
    // Update progress: downloading
    await setDoc(pipelineDocRef, {
      progress: { downloading: true, chunking: false, embedding: false, indexing: false, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Download file from R2
    const fileBuffer = await downloadFileFromR2(r2Key);
    
    // Update progress: chunking
    await setDoc(pipelineDocRef, {
      progress: { downloading: true, chunking: true, embedding: false, indexing: false, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Process file into chunks
    const chunks = await processFileToChunks(fileBuffer, mimeType, fileName, fileId);
    
    // Update progress: embedding
    await setDoc(pipelineDocRef, {
      progress: { downloading: true, chunking: true, embedding: true, indexing: false, completed: false },
      updatedAt: new Date(),
      chunksCount: chunks.length
    }, { merge: true });
    
    // Generate embeddings for each chunk
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbeddings(chunk.text);
      
      vectors.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          ...chunk.metadata,
          text: chunk.text,
          purpose,
          context: context || ''
        }
      });
    }
    
    // Update progress: indexing
    await setDoc(pipelineDocRef, {
      progress: { downloading: true, chunking: true, embedding: true, indexing: true, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Upsert to Pinecone
    // Create index name from userId and pipelineId
    const indexName = `ctx-${userId.toLowerCase()}-${pipelineId.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-');
    await upsertEmbeddings(indexName, vectors);
    
    // Update progress: completed
    await setDoc(pipelineDocRef, {
      status: 'completed',
      progress: { downloading: true, chunking: true, embedding: true, indexing: true, completed: true },
      updatedAt: new Date(),
      vectorsCount: vectors.length
    }, { merge: true });
    
    console.log(`Pipeline ${pipelineId} completed successfully`);
  } catch (error) {
    console.error(`Pipeline ${pipelineId} failed:`, error);
    
    // Update pipeline with error status
    await setDoc(pipelineDocRef, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: new Date()
    }, { merge: true });
  }
}
