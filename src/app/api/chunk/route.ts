import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { createPipeline } from '@/lib/services/pipeline';
import { extractTextFromFile } from '@/lib/text-processor';
import { generateDownloadUrl } from '@/lib/r2-client';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import chalk from 'chalk';
import { z } from 'zod';

// Request schema validation
const ChunkRequestSchema = z.object({
  fileIds: z.array(z.string()).min(1, 'At least one file ID is required'),
  indexName: z.string().min(1, 'Index name is required'),
  namespace: z.string().optional(),
});

interface ChunkRequest {
  fileIds: string[];
  indexName: string;
  namespace?: string;
}

/**
 * POST /api/chunk - Process documents through chunking, embedding, and vector storage pipeline
 */
export const POST = withAuth(async (req) => {
  console.log(chalk.magenta.bold('\n🚀 [API /chunk] Starting document processing pipeline'));
  
  try {
    const body: ChunkRequest = await req.json();
    const validation = ChunkRequestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error(chalk.red(`├── ❌ Validation failed: ${validation.error.message}`));
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const { fileIds, indexName, namespace } = validation.data;
    
    console.log(chalk.blue(`├── 📋 Processing ${fileIds.length} files for user: ${req.userId}`));
    console.log(chalk.blue(`├── 🗃️  Target index: ${indexName}${namespace ? ` (namespace: ${namespace})` : ''}`));

    // Validate environment variables
    const openaiApiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws';

    if (!openaiApiKey) {
      console.error(chalk.red('├── ❌ OpenAI API key is missing!'));
      return errorResponse('OpenAI API key not configured', 500);
    }

    if (!pineconeApiKey) {
      console.error(chalk.red('├── ❌ Pinecone API key is missing!'));
      return errorResponse('Pinecone API key not configured', 500);
    }

    console.log(chalk.green('├── ✅ Environment variables validated'));

    // Initialize pipeline
    const pipeline = createPipeline({
      openaiApiKey,
      pineconeApiKey,
      pineconeEnvironment,
      embeddingModel: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-3-small',
      completionModel: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4o',
      chunkSize: 800,
      chunkOverlap: 150,
      maxContextTokens: 3000,
    });

    await pipeline.initializeVectorDB(indexName, namespace);

    // Process each file
    const documents = [];
    
    for (const fileId of fileIds) {
      console.log(chalk.yellow(`├── 📄 Processing file: ${fileId}`));
      
      // Get file metadata from Firestore
      const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
      const fileDoc = await getDoc(fileDocRef);
      
      if (!fileDoc.exists()) {
        console.error(chalk.red(`├── ❌ File not found: ${fileId}`));
        return errorResponse(`File not found: ${fileId}`, 404);
      }
      
      const fileData = fileDoc.data();
      const { name: fileName, mimeType, r2Key } = fileData;
      
      console.log(chalk.blue(`├── 📋 File details: ${fileName} (${mimeType})`));
      
      try {
        // Download file from R2
        console.log(chalk.blue(`├── ⬇️  Downloading from R2: ${r2Key}`));
        const downloadUrl = await generateDownloadUrl(r2Key);
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        
        console.log(chalk.green(`├── ✅ Downloaded ${fileBuffer.length} bytes`));
        
        // Extract text from file
        console.log(chalk.blue(`├── 📝 Extracting text from ${fileName}`));
        const extractedText = await extractTextFromFile(fileBuffer, mimeType, fileName);
        
        console.log(chalk.green(`├── ✅ Extracted ${extractedText.length} characters`));
        
        documents.push({
          text: extractedText,
          docId: fileId,
          docName: fileName,
        });
        
      } catch (error) {
        console.error(chalk.red(`├── ❌ Failed to process file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`));
        return errorResponse(`Failed to process file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
      }
    }

    console.log(chalk.yellow(`├── 🚀 Starting pipeline processing for ${documents.length} documents`));
    
    // Process all documents through the pipeline
    const results = await pipeline.processMultipleDocuments(documents);
    
    // Calculate summary statistics
    const successful = results.filter(r => r.success);
    const totalChunks = successful.reduce((sum, r) => sum + r.chunksProcessed, 0);
    const totalVectors = successful.reduce((sum, r) => sum + r.vectorsStored, 0);
    const totalTime = successful.reduce((sum, r) => sum + r.processingTime, 0);
    
    console.log(chalk.green.bold('├── 🎉 PIPELINE PROCESSING COMPLETE'));
    console.log(chalk.green(`├── ├── ✅ Documents processed: ${successful.length}/${documents.length}`));
    console.log(chalk.green(`├── ├── ✅ Total chunks: ${totalChunks}`));
    console.log(chalk.green(`├── ├── ✅ Total vectors: ${totalVectors}`));
    console.log(chalk.green(`├── └── ✅ Total processing time: ${totalTime}ms`));
    
    return successResponse({
      success: true,
      documentsProcessed: successful.length,
      totalDocuments: documents.length,
      totalChunks,
      totalVectors,
      totalProcessingTime: totalTime,
      indexName,
      namespace,
      results,
    });
    
  } catch (error) {
    console.error(chalk.red.bold('├── ❌ PIPELINE PROCESSING FAILED'));
    console.error(chalk.red(`├── Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.error(chalk.red(`└── Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`));
    
    return errorResponse(
      `Pipeline processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
});
