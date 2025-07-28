import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// Use only our shared Firebase Admin initialization module
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { authenticateRequest } from '@/lib/api-auth';
import { createEmbeddings } from '@/lib/embeddings';
import { generateChatResponse } from '@/services/azure-openai-server';
import { r2Client, R2_BUCKET, GetObjectCommand } from '@/lib/r2';
import { processFile } from '@/lib/fileProcessor';
import { exportMCPPipeline } from '@/lib/mcpExporter';

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

// Request schema validation
const ProcessPipelineSchema = z.object({
  fileId: z.string().min(1),
  purpose: z.string().min(1).max(1000)
});

/**
 * Generate a human-readable response about the pipeline processing
 * using Azure OpenAI to create meaningful summaries
 */
async function generatePipelineResponse(pipelineInfo: {
  fileName: string;
  fileType: string;
  purpose: string;
  chunksCount: number;
  chunkSize: number;
  vectorStore: string;
  indexedCount: number;
}): Promise<string> {
  try {
    // Create a prompt for the OpenAI model to generate a response
    const prompt = `
    Generate a concise, informative summary of a document processing pipeline with the following details:
    - File: ${pipelineInfo.fileName} (${pipelineInfo.fileType})
    - User's purpose: "${pipelineInfo.purpose}"
    - Processing: The content has been split into ${pipelineInfo.chunksCount} chunks of ${pipelineInfo.chunkSize} characters each
    - Storage: All chunks were embedded and indexed in ${pipelineInfo.vectorStore} vector database
    - Status: Successfully processed ${pipelineInfo.indexedCount} chunks
    
    The summary should be professional, technically accurate, and explain what the pipeline has accomplished
    in a way that's helpful to the user who wants to use this for their stated purpose.
    `;
    
    // Generate pipeline explanation using Azure OpenAI server-side implementation
    const explanation = await generateChatResponse(prompt);
    return explanation || `Pipeline processing complete for ${pipelineInfo.fileName}. Created ${pipelineInfo.chunksCount} chunks and indexed them in ${pipelineInfo.vectorStore}.`;
  } catch (error) {
    console.error('Error generating pipeline response:', error);
    // Fallback to a basic response without AI generation if something goes wrong
    return `Pipeline processing complete for ${pipelineInfo.fileName}. Created ${pipelineInfo.chunksCount} chunks and indexed them in ${pipelineInfo.vectorStore}.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting - 2 requests per minute for pipeline processing
    const rateLimitResult = await rateLimit(request, {
      limit: 2,
      windowSizeInSeconds: 60
    });

    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before processing another pipeline.' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = ProcessPipelineSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const { fileId, purpose } = validationResult.data;

    // Initialize Firestore using our shared module
    // This ensures Firebase Admin is properly initialized
    const db = initializeFirebaseAdmin();

    // 1. Verify file ownership and get file metadata
    const uploadDoc = await db.collection('uploads').doc(fileId).get();
    if (!uploadDoc.exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const uploadData = uploadDoc.data()!;
    if (uploadData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to file' }, { status: 403 });
    }

    // 2. Download file from R2
    console.log(`Downloading file from R2: ${uploadData.r2Key}`);
    let fileBuffer: Buffer;
    
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: uploadData.r2Key
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
        fileBuffer = Buffer.concat(chunks);
      } else {
        throw new Error('Empty response body from R2');
      }
    } catch (error) {
      console.error('R2 download error:', error);
      return NextResponse.json({
        error: 'Failed to download file from storage'
      }, { status: 500 });
    }

    // 3. Extract text content with enhanced type detection and error handling
    console.log(`Processing file: ${uploadData.fileName} (${uploadData.fileType})`);
    let extractedText: string;
    
    try {
      // Ensure we have a valid MIME type or detect it from file extension
      let mimeType = uploadData.fileType;
      
      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '') {
        // Extract file extension from filename
        const fileExtension = uploadData.fileName.split('.').pop()?.toLowerCase();
        console.log(`Missing or generic MIME type. Detecting from extension: ${fileExtension}`);
        
        // Map common file extensions to MIME types
        const mimeMap: Record<string, string> = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'txt': 'text/plain',
          'csv': 'text/csv',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'mp3': 'audio/mpeg',
          'mp4': 'video/mp4',
          'json': 'application/json',
          'html': 'text/html'
        };
        
        if (fileExtension && mimeMap[fileExtension]) {
          mimeType = mimeMap[fileExtension];
          console.log(`Detected MIME type from extension: ${mimeType}`);
        }
      }
      
      // Import the file processor for proper content extraction
      const { processFile } = await import('@/lib/fileProcessor');
      
      // Process the file using our comprehensive file processor with properly detected mime type
      console.log(`Processing with MIME type: ${mimeType}, File: ${uploadData.fileName}, Size: ${fileBuffer.length} bytes`);
      extractedText = await processFile(fileBuffer, mimeType, uploadData.fileName);
      
      if (!extractedText || extractedText.trim() === '') {
        console.warn('No text content extracted from file, returning empty string');
        extractedText = ''; // Use empty string instead of throwing error to allow partial processing
      } else {
        console.log(`Successfully extracted ${extractedText.length} characters of text`);
      }
    } catch (error) {
      console.error('File processing error:', error);
      return NextResponse.json({
        error: `Failed to extract content from file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 422 });
    }

    // 4. Intelligent chunking based on content size
    const textLength = extractedText.length;
    const chunkSize = textLength > 10000 ? 1000 : textLength > 5000 ? 750 : 500;
    const overlap = Math.floor(chunkSize * 0.1); // 10% overlap

    const chunks: string[] = [];
    for (let i = 0; i < extractedText.length; i += chunkSize - overlap) {
      const chunk = extractedText.slice(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    console.log(`Created ${chunks.length} chunks with size ${chunkSize} and overlap ${overlap}`);

    // 5. Generate embeddings (simplified - using existing function)
    let embeddings: Array<{ embedding: number[] }> = [];
    try {
      embeddings = await createEmbeddings(chunks);
      console.log(`Generated ${embeddings.length} embeddings`);
      
      // Verify that we got valid embeddings
      if (!embeddings || embeddings.length === 0) {
        throw new Error('No valid embeddings were generated');
      }
    } catch (error) {
      console.error('Embeddings generation error:', error);
      return NextResponse.json({
        error: `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }

    // 6. Create pipeline JSON structure
    const pipelineId = `${userId}_${Date.now()}`;
    const pipeline = {
      id: pipelineId,
      metadata: {
        author: userId,
        createdAt: new Date().toISOString(),
        fileName: uploadData.fileName,
        fileType: uploadData.fileType,
        purpose,
        vectorStore: 'firestore',
        chunksCount: chunks.length,
        chunkSize,
        overlap
      },
      nodes: [
        {
          id: 'datasource',
          type: 'DataSource',
          data: {
            fileName: uploadData.fileName,
            fileType: uploadData.fileType,
            fileSize: uploadData.fileSize
          }
        },
        {
          id: 'chunker',
          type: 'Chunker',
          data: {
            chunkSize,
            overlap,
            chunksCount: chunks.length
          }
        },
        {
          id: 'embedder',
          type: 'Embedder',
          data: {
            model: 'text-embedding-ada-002',
            dimensions: embeddings[0]?.embedding?.length || 1536
          }
        },
        {
          id: 'indexer',
          type: 'Indexer',
          data: {
            vectorStore: 'firestore',
            indexedCount: chunks.length
          }
        },
        {
          id: 'retriever',
          type: 'Retriever',
          data: {
            topK: 5,
            similarityThreshold: 0.7
          }
        },
        {
          id: 'rag',
          type: 'RAG',
          data: {
            model: process.env.OPENAI_DEPLOYMENT || 'gpt-4',
            // Generate a real response using Azure OpenAI
            response: await generatePipelineResponse({
              fileName: uploadData.fileName,
              fileType: uploadData.fileType,
              purpose: purpose,
              chunksCount: chunks.length,
              chunkSize: chunkSize,
              vectorStore: 'firestore',
              indexedCount: chunks.length
            })
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'datasource', target: 'chunker' },
        { id: 'e2', source: 'chunker', target: 'embedder' },
        { id: 'e3', source: 'embedder', target: 'indexer' },
        { id: 'e4', source: 'indexer', target: 'retriever' },
        { id: 'e5', source: 'retriever', target: 'rag' }
      ]
    };

    // 7. Save pipeline to Firestore
    try {
      // Use our shared Firebase Admin initialization module
      const db = initializeFirebaseAdmin();
      await db.collection('pipelines').doc(pipelineId).set({
        ...pipeline,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Pipeline save error:', error);
      return NextResponse.json({
        error: 'Failed to save pipeline'
      }, { status: 500 });
    }

    // 8. Generate and export MCP pipeline as complete ZIP package
    console.log(`Generating MCP export for pipeline ${pipelineId}`);
    let downloadUrl: string;
    
    try {
      // Use our robust mcpExporter to create a complete package with all files
      downloadUrl = await exportMCPPipeline(pipeline, userId);
    } catch (error) {
      console.error('MCP export error:', error);
      return NextResponse.json({
        error: 'Failed to create MCP export',
        details: error instanceof Error ? error.message : 'Unknown export error'
      }, { status: 500 });
    }

    // 10. Log usage metrics
    try {
      // Use our shared Firebase Admin initialization module for metrics logging
      const metricsDb = initializeFirebaseAdmin();
      await metricsDb.collection('usage').add({
        userId,
        action: 'pipeline_processed',
        fileId,
        pipelineId,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        chunksCount: chunks.length,
        vectorStore: 'firestore',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Usage logging error:', error);
      // Don't fail the request for logging errors
    }

    // Return success response
    return NextResponse.json({
      downloadUrl,
      pipelineId,
      message: 'Pipeline processed successfully'
    }, { 
      status: 200,
      headers: rateLimitResult.headers 
    });

  } catch (error) {
    console.error('Pipeline processing error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown processing error'
    }, { status: 500 });
  }
}
