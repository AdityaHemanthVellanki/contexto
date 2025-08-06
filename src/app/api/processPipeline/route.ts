import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { generateEmbeddings } from '@/lib/azure-openai';
import { upsertEmbeddings } from '@/lib/pinecone-client';
import { generateDownloadUrl } from '@/lib/r2-client';
import { processFileToChunks, processDescriptionToChunks } from '@/lib/text-processor';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

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
  name: z.string().min(1).max(200).optional().default('MCP Pipeline')
});

interface ProcessPipelineRequest {
  fileIds?: string[];
  description: string;
  tools?: Tool[];
  autoGenerateTools?: boolean;
  name?: string;
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
    
    const { fileIds = [], description, tools = [], autoGenerateTools = false, name = 'MCP Pipeline' } = validation.data;
    
    // Validate that either files are provided or description is sufficient
    if (fileIds.length === 0 && description.trim().length < 10) {
      return errorResponse('Either upload files or provide a detailed description (at least 10 characters)');
    }
    
    // Get file metadata from Firestore for all files
    const fileDataList = [];
    for (const fileId of fileIds) {
      const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
      const fileDoc = await getDoc(fileDocRef);
      
      if (!fileDoc.exists()) {
        return errorResponse(`File not found: ${fileId}`, 404);
      }
      
      const fileData = fileDoc.data();
      fileDataList.push({
        id: fileId,
        name: fileData.name,
        mimeType: fileData.mimeType,
        r2Key: fileData.r2Key,
        size: fileData.size
      });
    }
    
    // Generate unique pipeline ID
    const pipelineId = uuidv4();
    
    // Create pipeline record
    const pipelineData = {
      id: pipelineId,
      name,
      fileIds,
      fileNames: fileDataList.map(f => f.name),
      description,
      tools,
      autoGenerateTools,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: req.userId,
      progress: {
        downloading: false,
        extracting: false,
        chunking: false,
        embedding: false,
        indexing: false,
        completed: false
      },
      stage: 'downloading',
      progressPercent: 0
    };
    
    const pipelineDocRef = doc(db, 'users', req.userId, 'pipelines', pipelineId);
    await setDoc(pipelineDocRef, pipelineData);
    
    // Start processing pipeline asynchronously
    processPipelineAsync(req.userId, pipelineId, fileDataList, description, tools, autoGenerateTools);
    
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
  fileDataList: Array<{
    id: string;
    name: string;
    mimeType: string;
    r2Key: string;
    size: number;
  }>,
  description: string,
  tools: Tool[],
  autoGenerateTools: boolean
) {
  const pipelineDocRef = doc(db, 'users', userId, 'pipelines', pipelineId);
  
  try {
    // Update progress: downloading
    await setDoc(pipelineDocRef, {
      stage: 'downloading',
      progressPercent: 10,
      progress: { downloading: true, extracting: false, chunking: false, embedding: false, indexing: false, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Process all files or use description-based content
    let allChunks: any[] = [];
    
    if (fileDataList.length > 0) {
      // Download and process each file
      for (let i = 0; i < fileDataList.length; i++) {
        const fileData = fileDataList[i];
        const progressPercent = 10 + (i / fileDataList.length) * 30; // 10-40%
        
        await setDoc(pipelineDocRef, {
          stage: 'downloading',
          progressPercent,
          updatedAt: new Date()
        }, { merge: true });
        
        // Download file from R2
        const fileBuffer = await downloadFileFromR2(fileData.r2Key);
        
        // Update progress: extracting
        await setDoc(pipelineDocRef, {
          stage: 'extracting',
          progressPercent: progressPercent + 5,
          progress: { downloading: true, extracting: true, chunking: false, embedding: false, indexing: false, completed: false },
          updatedAt: new Date()
        }, { merge: true });
        
        // Process file into chunks
        const fileChunks = await processFileToChunks(fileBuffer, fileData.mimeType, fileData.name, fileData.id);
        allChunks.push(...fileChunks);
      }
    } else {
      // Create chunks from description only
      const descriptionChunks = await processDescriptionToChunks(description, pipelineId);
      allChunks.push(...descriptionChunks);
    }
    
    // Update progress: chunking complete
    await setDoc(pipelineDocRef, {
      stage: 'chunking',
      progressPercent: 50,
      progress: { downloading: true, extracting: true, chunking: true, embedding: false, indexing: false, completed: false },
      updatedAt: new Date(),
      chunksCount: allChunks.length
    }, { merge: true });
    
    // Update progress: embedding
    await setDoc(pipelineDocRef, {
      stage: 'embedding',
      progressPercent: 60,
      progress: { downloading: true, extracting: true, chunking: true, embedding: true, indexing: false, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Generate embeddings for each chunk
    const vectors = [];
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const progressPercent = 60 + (i / allChunks.length) * 20; // 60-80%
      
      await setDoc(pipelineDocRef, {
        stage: 'embedding',
        progressPercent,
        updatedAt: new Date()
      }, { merge: true });
      
      const embedding = await generateEmbeddings(chunk.text);
      
      vectors.push({
        id: chunk.id,
        values: embedding,
        metadata: {
          ...chunk.metadata,
          text: chunk.text,
          description,
          tools: JSON.stringify(tools),
          autoGenerateTools
        }
      });
    }
    
    // Update progress: indexing
    await setDoc(pipelineDocRef, {
      stage: 'indexing',
      progressPercent: 85,
      progress: { downloading: true, extracting: true, chunking: true, embedding: true, indexing: true, completed: false },
      updatedAt: new Date()
    }, { merge: true });
    
    // Upsert to Pinecone
    // Create index name from userId and pipelineId
    const indexName = `ctx-${userId.toLowerCase()}-${pipelineId.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-');
    await upsertEmbeddings(indexName, vectors);
    
    // Update progress: completed
    await setDoc(pipelineDocRef, {
      status: 'completed',
      stage: 'complete',
      progressPercent: 100,
      progress: { downloading: true, extracting: true, chunking: true, embedding: true, indexing: true, completed: true },
      updatedAt: new Date(),
      vectorsCount: vectors.length,
      indexName
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
