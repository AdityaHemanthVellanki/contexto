import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { app } from '@/lib/firebase';
import { extractText } from '@/lib/textExtraction';
import { createEmbeddings } from '@/lib/embeddings';

// Initialize Firebase Admin services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const bucket = storage.bucket();

export async function POST(request: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    // Get fileId from request body
    const body = await request.json();
    const { fileId } = body;
    
    if (!fileId) {
      return NextResponse.json({ message: 'Bad request: No fileId provided' }, { status: 400 });
    }

    // Verify file ownership
    const uploadRef = db.collection('uploads').doc(fileId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    
    const uploadData = uploadDoc.data();
    if (uploadData?.userId !== userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not own this file' }, { status: 403 });
    }

    // Update status to processing
    await uploadRef.update({
      status: 'processing',
      processingStartedAt: Timestamp.now()
    });

    // Create a default pipeline configuration
    const pipelineId = fileId;
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
    // 1. Download the file
    const filePath = uploadData.filePath;
    const tempFilePath = `/tmp/${fileId}`;
    
    await bucket.file(filePath).download({
      destination: tempFilePath
    });

    // 2. Extract text based on file type
    const fileContent = await extractText(tempFilePath, uploadData.fileType);
    
    // 3. Chunk the text
    const chunkSize = pipelineConfig.nodes.find(n => n.type === 'chunker')?.data?.chunkSize || 1000;
    const chunkOverlap = pipelineConfig.nodes.find(n => n.type === 'chunker')?.data?.chunkOverlap || 200;
    
    type TextChunk = {
      text: string;
      index: number;
    };
    
    const chunks: TextChunk[] = [];
    let startIndex = 0;
    
    while (startIndex < fileContent.length) {
      const endIndex = Math.min(startIndex + chunkSize, fileContent.length);
      chunks.push({
        text: fileContent.slice(startIndex, endIndex),
        index: chunks.length
      });
      startIndex = endIndex - chunkOverlap;
    }

    // 4. Generate embeddings for each chunk
    const embeddingResults = await createEmbeddings(chunks.map(chunk => chunk.text), pipelineId);
    
    // 5. Store embeddings in Firestore
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
    const chunksBatch = db.batch();
    embeddingResults.forEach((result: { embedding: number[] }, index: number) => {
      const chunkRef = embeddingsRef.collection('chunks').doc(`chunk-${index}`);
      chunksBatch.set(chunkRef, {
        index,
        text: chunks[index].text,
        embedding: result.embedding,
        createdAt: Timestamp.now()
      });
    });
    
    await chunksBatch.commit();
    
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
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    return NextResponse.json({ message: `Ingestion failed: ${message}` }, { status: 500 });
  }
}
