import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { authenticateRequest } from '@/lib/api-auth';
import { extractText } from '@/lib/textExtraction';
import { createEmbeddings } from '@/lib/embeddings';
import { r2, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for ingest API');
} catch (error) {
  console.error('❌ Firebase initialization failed in ingest API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using our helper
    const authResult = await authenticateRequest(request);
    
    if (!authResult.authenticated) {
      // authenticateRequest already returns a proper NextResponse for errors
      return authResult.response;
    }
    
    const userId = authResult.userId;

    // Get fileId from request body
    const body = await request.json();
    const { fileId } = body;
    
    if (!fileId) {
      return NextResponse.json({ message: 'Bad request: No fileId provided' }, { status: 400 });
    }

    // Verify file ownership
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    const uploadRef = db.collection('uploads').doc(fileId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    
    const uploadData = uploadDoc.data();
    if (!uploadData) {
      return NextResponse.json({ message: 'Invalid file data' }, { status: 400 });
    }
    if (uploadData.userId !== userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not own this file' }, { status: 403 });
    }

    // Update status to processing
    await uploadRef.update({
      status: 'processing',
      processingStartedAt: Timestamp.now()
    });

    // Create a default pipeline configuration
    const pipelineId = fileId;
    // Using the db instance we already initialized above
    const pipelineRef = db.collection('pipelines').doc(pipelineId);
    
    // Default pipeline configuration
    const pipelineConfig = {
      id: pipelineId,
      userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      fileId,
      name: `Pipeline for ${uploadData.fileName}`,
      nodes: [
        {
          id: 'dataSource',
          type: 'dataSource',
          position: { x: 100, y: 100 },
          data: {
            fileId,
            fileUrl: uploadData.fileUrl,
            fileName: uploadData.fileName
          }
        },
        {
          id: 'chunker',
          type: 'chunker',
          position: { x: 100, y: 200 },
          data: {
            chunkSize: 1000,
            chunkOverlap: 200
          }
        },
        {
          id: 'embedder',
          type: 'embedder',
          position: { x: 100, y: 300 },
          data: {
            model: 'azure-openai-embedding-ada-002',
            dimensions: 1536
          }
        },
        {
          id: 'indexer',
          type: 'indexer',
          position: { x: 100, y: 400 },
          data: {
            indexType: 'faiss',
            indexName: `index-${fileId}`
          }
        },
        {
          id: 'retriever',
          type: 'retriever',
          position: { x: 100, y: 500 },
          data: {
            topK: 5,
            similarityThreshold: 0.7
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'dataSource', target: 'chunker' },
        { id: 'e2', source: 'chunker', target: 'embedder' },
        { id: 'e3', source: 'embedder', target: 'indexer' },
        { id: 'e4', source: 'indexer', target: 'retriever' }
      ]
    };
    
    // Store the pipeline configuration
    await pipelineRef.set(pipelineConfig);

    // Process the document based on file type
    // 1. Download the file from R2
    const r2Key = uploadData.r2Key || `${userId}/uploads/${uploadData.fileName}`;
    const tempFilePath = `/tmp/${fileId}_${uploadData.fileName}`;
    
    try {
      // Fetch object from R2
      const getObjectResponse = await r2.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
        })
      );
      
      // Create local file from stream
      if (getObjectResponse.Body) {
        // Create the directory if it doesn't exist
        await fs.mkdir('/tmp', { recursive: true }).catch(() => {});
        
        // Create a write stream to the temp file
        const writeStream = createWriteStream(tempFilePath);
        
        // Use the pipeline to pipe the response body to the file
        await pipeline(getObjectResponse.Body as NodeJS.ReadableStream, writeStream);
        
        console.log(`File downloaded from R2: ${r2Key} to ${tempFilePath}`);
      } else {
        throw new Error('Empty response body from R2');
      }
    } catch (downloadError) {
      console.error('Error downloading file from R2:', downloadError);
      throw new Error(`Failed to download file from R2: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
    }

    // 2. Extract text based on file type
    let fileContent: string;
    try {
      fileContent = await extractText(tempFilePath, uploadData.fileType);
      
      // Validate extracted content
      if (!fileContent || fileContent.length === 0) {
        throw new Error(`No text content could be extracted from file: ${uploadData.fileName}`);
      }
      
      console.log(`Successfully extracted ${fileContent.length} characters from ${uploadData.fileName}`);
    } catch (extractError) {
      console.error('Text extraction error:', extractError);
      
      // Update file status to error
      await uploadRef.update({
        status: 'error',
        error: extractError instanceof Error ? extractError.message : 'Failed to extract text from file',
        processingCompletedAt: Timestamp.now()
      });
      
      throw new Error(`Text extraction failed: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }
    
    // 3. Chunk the text
    const chunkSize = pipelineConfig.nodes.find(n => n.type === 'chunker')?.data?.chunkSize || 1000;
    const chunkOverlap = pipelineConfig.nodes.find(n => n.type === 'chunker')?.data?.chunkOverlap || 200;
    const MAX_CHUNKS = 10000; // Set a reasonable maximum number of chunks
    
    type TextChunk = {
      text: string;
      index: number;
    };
    
    const chunks: TextChunk[] = [];
    let startIndex = 0;
    
    // If file is too large, adjust chunk size to fit within MAX_CHUNKS
    const estimatedChunks = Math.ceil(fileContent.length / (chunkSize - chunkOverlap));
    const adjustedChunkSize = estimatedChunks > MAX_CHUNKS ? 
      Math.ceil(fileContent.length / MAX_CHUNKS) + chunkOverlap : chunkSize;
    
    console.log(`File length: ${fileContent.length}, Estimated chunks: ${estimatedChunks}`);
    console.log(`Using chunk size: ${adjustedChunkSize}, overlap: ${chunkOverlap}`);
    
    while (startIndex < fileContent.length && chunks.length < MAX_CHUNKS) {
      const endIndex = Math.min(startIndex + adjustedChunkSize, fileContent.length);
      chunks.push({
        text: fileContent.slice(startIndex, endIndex),
        index: chunks.length
      });
      startIndex = endIndex - chunkOverlap;
      
      // Safety check - if we're not making progress, break
      if (endIndex === startIndex + chunkOverlap) {
        console.warn('Chunking not making progress - breaking loop');
        break;
      }
    }
    
    // If we hit the chunk limit, log a warning
    if (chunks.length >= MAX_CHUNKS) {
      console.warn(`Hit maximum chunk limit (${MAX_CHUNKS}). File may be partially processed.`);
    }

    // 4. Generate embeddings for each chunk
    // Process chunks in batches if needed to avoid memory issues
    const BATCH_SIZE = 1000;
    
    // Define the type for embedding results
    type EmbeddingResult = {
      embedding: number[];
      [key: string]: any; // For any additional properties
    };
    
    let allEmbeddingResults: EmbeddingResult[] = [];
    
    try {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        console.log(`Processing embedding batch ${i/BATCH_SIZE + 1} of ${Math.ceil(chunks.length/BATCH_SIZE)}`);
        
        try {
          const batchResults = await createEmbeddings(batchChunks.map(chunk => chunk.text), pipelineId) as EmbeddingResult[];
          
          // Validate embedding results
          if (!batchResults || batchResults.length === 0) {
            throw new Error(`Failed to generate embeddings for batch ${i/BATCH_SIZE + 1}`);
          }
          
          // Validate that each embedding has the expected structure
          for (const result of batchResults) {
            if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length === 0) {
              throw new Error('Invalid embedding format received from embedding service');
            }
          }
          
          allEmbeddingResults = [...allEmbeddingResults, ...batchResults];
        } catch (batchError) {
          console.error(`Error processing batch ${i/BATCH_SIZE + 1}:`, batchError);
          // Continue with next batch instead of failing completely
          // This allows partial processing of large files
          console.warn(`Partial batch processing error: Batch ${i/BATCH_SIZE + 1} failed but continuing with remaining batches`);
        }
      }
      
      if (allEmbeddingResults.length === 0) {
        throw new Error('Failed to generate any embeddings for the document');
      }
      
      console.log(`Successfully generated ${allEmbeddingResults.length} embeddings`);
    } catch (embeddingError) {
      console.error('Embedding generation error:', embeddingError);
      
      // Update file status to error
      await uploadRef.update({
        status: 'error',
        error: embeddingError instanceof Error ? embeddingError.message : 'Failed to generate embeddings',
        processingCompletedAt: Timestamp.now()
      });
      
      throw new Error(`Embedding generation failed: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
    }
    
    const embeddingResults = allEmbeddingResults;
    
    // 5. Store embeddings in Firestore
    // Using the db instance we already initialized above
    const embeddingsRef = db.collection('embeddings').doc(pipelineId);
    await embeddingsRef.set({
      pipelineId,
      fileId,
      userId,
      count: embeddingResults.length,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    // Store chunks and embeddings in a subcollection
    // Use multiple batches to avoid Firestore batch size limits
    const FIRESTORE_BATCH_LIMIT = 500;
    
    for (let i = 0; i < embeddingResults.length; i += FIRESTORE_BATCH_LIMIT) {
      // Using the db instance we already initialized above
      const chunksBatch = db.batch();
      const batchEnd = Math.min(i + FIRESTORE_BATCH_LIMIT, embeddingResults.length);
      
      console.log(`Storing chunks batch ${i/FIRESTORE_BATCH_LIMIT + 1} of ${Math.ceil(embeddingResults.length/FIRESTORE_BATCH_LIMIT)}`);
      
      for (let j = i; j < batchEnd; j++) {
        const result = embeddingResults[j];
        const chunkRef = embeddingsRef.collection('chunks').doc(`chunk-${j}`);
        
        // Make sure we have valid data before adding to batch
        if (result && result.embedding && chunks[j] && chunks[j].text) {
          chunksBatch.set(chunkRef, {
            index: j,
            text: chunks[j].text,
            embedding: result.embedding,
            createdAt: Timestamp.now()
          });
        } else {
          console.warn(`Skipping invalid chunk or embedding at index ${j}`);
        }
      }
      
      await chunksBatch.commit();
    }
    
    // Update the upload status
    await uploadRef.update({
      status: 'processed',
      processingCompletedAt: Timestamp.now(),
      totalChunks: chunks.length
    });

    // Return success response
    return NextResponse.json({
      fileId,
      pipelineId,
      status: 'success',
      message: 'Document processed successfully',
      ingestionReport: {
        totalChunks: chunks.length,
        embeddingsGenerated: embeddingResults.length,
        fileSize: uploadData.fileSize,
        fileName: uploadData.fileName
      }
    });
  } catch (error) {
    console.error('Ingestion error:', error);
    
    // Create a detailed error response
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown ingestion error',
      code: 'INGESTION_ERROR',
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    };
    
    console.error('Detailed ingestion error:', JSON.stringify(errorDetails, null, 2));
    
    return NextResponse.json({ 
      message: `Ingestion failed: ${errorDetails.message}`,
      error: errorDetails
    }, { status: 500 });
  }
}
