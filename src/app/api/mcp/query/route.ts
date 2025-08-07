import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { PipelineLogger } from '@/lib/utils/pipeline-logger';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VectorIndexManager } from '@/lib/vector-index';
import { OpenAIService } from '@/lib/openai-service';

interface MCPQueryRequest {
  mcpId: string;
  question: string;
  maxResults?: number;
  includeMetadata?: boolean;
}

interface QueryResponse {
  answer: string;
  sources: Array<{
    docId: string;
    docName: string;
    relevanceScore: number;
    text: string;
  }>;
  processingTime: number;
  tokensUsed: number;
}

/**
 * POST /api/mcp/query - Query MCP using production-grade RAG (Retrieval Augmented Generation)
 * 
 * Flow:
 * 1. Validate MCP exists and is complete
 * 2. Generate query embedding using OpenAI
 * 3. Retrieve relevant chunks via vector similarity search
 * 4. Compose context from retrieved chunks
 * 5. Generate response using OpenAI completions
 * 6. Log query and return answer with source citations
 */
export const POST = withAuth(async (req) => {
  const logger = new PipelineLogger('MCP_QUERY');
  let body: MCPQueryRequest;
  
  try {
    body = await req.json();
    const { mcpId, question, maxResults = 5, includeMetadata = true } = body;

    if (!mcpId || !question) {
      return errorResponse('Missing required fields: mcpId, question');
    }

    logger.stageHeader('MCP QUERY PROCESSING');
    logger.info(`Query: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`);
    logger.info(`MCP ID: ${mcpId}, Max Results: ${maxResults}`);

    // Step 1: Validate MCP exists and is complete
    logger.stageHeader('MCP VALIDATION');
    const mcpRef = doc(db, 'mcps', req.userId, 'user_mcps', mcpId);
    const mcpDoc = await getDoc(mcpRef);

    if (!mcpDoc.exists()) {
      return errorResponse('MCP not found', 404);
    }

    const mcpData = mcpDoc.data();
    if (mcpData.status !== 'complete') {
      return errorResponse(`MCP is not ready for queries. Current status: ${mcpData.status}`, 400);
    }

    logger.stageComplete('MCP validation complete', {
      'MCP Title': mcpData.title,
      'Chunks Available': mcpData.numChunks?.toString() || '0',
      'Embedding Model': mcpData.embeddingModel
    });

    // Step 2: Initialize OpenAI service and generate query embedding
    logger.stageHeader('QUERY EMBEDDING');
    const openaiService = new OpenAIService(
      process.env.OPENAI_API_KEY!,
      mcpData.embeddingModel || 'text-embedding-3-small',
      'gpt-4',
      logger
    );

    const queryEmbeddingResult = await openaiService.generateEmbedding(question);
    logger.stageComplete('Query embedding generated', {
      'Tokens Used': queryEmbeddingResult.tokenCount.toString(),
      'Processing Time': `${queryEmbeddingResult.processingTime}ms`,
      'Embedding Dimensions': queryEmbeddingResult.embedding.length.toString()
    });

    // Step 3: Retrieve relevant chunks using vector similarity
    logger.stageHeader('VECTOR SIMILARITY SEARCH');
    const vectorManager = VectorIndexManager.getInstance();
    const vectorIndex = vectorManager.getIndex(mcpId);
    
    const similarityResults = await vectorIndex.search(queryEmbeddingResult.embedding, maxResults);
    
    if (similarityResults.length === 0) {
      logger.warn('No similar chunks found');
      return successResponse({
        query: question,
        mcp: {
          id: mcpId,
          title: mcpData.title,
          fileName: mcpData.fileName
        },
        result: {
          answer: 'I could not find any relevant information in the document to answer your question.',
          sources: [],
          processingTime: 0,
          tokensUsed: queryEmbeddingResult.tokenCount
        }
      });
    }

    logger.stageComplete('Similarity search complete', {
      'Chunks Found': similarityResults.length.toString(),
      'Best Score': similarityResults[0].score.toFixed(4),
      'Worst Score': similarityResults[similarityResults.length - 1].score.toFixed(4)
    });

    // Step 4: Compose context from retrieved chunks
    logger.stageHeader('CONTEXT COMPOSITION');
    const contextChunks = similarityResults.map((result, index) => 
      `[Source ${index + 1}] ${result.chunk.text}`
    );
    const context = contextChunks.join('\n\n');
    
    logger.info(`Context composed: ${context.length} characters from ${contextChunks.length} chunks`);

    // Step 5: Generate response using OpenAI completions
    logger.stageHeader('RESPONSE GENERATION');
    const completionResult = await openaiService.generateCompletion(
      question,
      context,
      1000 // max tokens for response
    );

    logger.stageComplete('Response generation complete', {
      'Prompt Tokens': completionResult.tokenUsage.promptTokens.toString(),
      'Completion Tokens': completionResult.tokenUsage.completionTokens.toString(),
      'Total Tokens': completionResult.tokenUsage.totalTokens.toString(),
      'Processing Time': `${completionResult.processingTime}ms`
    });

    // Step 6: Log query to Firestore and format response
    const totalProcessingTime = queryEmbeddingResult.processingTime + completionResult.processingTime;
    const totalTokensUsed = queryEmbeddingResult.tokenCount + completionResult.tokenUsage.totalTokens;

    await logQueryToFirestore(req.userId, mcpId, {
      question,
      answer: completionResult.response,
      sourcesCount: similarityResults.length,
      tokensUsed: totalTokensUsed,
      processingTime: totalProcessingTime,
      bestSimilarityScore: similarityResults[0].score
    });

    const response: QueryResponse = {
      answer: completionResult.response,
      sources: similarityResults.map((result, index) => ({
        docId: result.chunk.metadata.docId,
        docName: result.chunk.metadata.docName,
        relevanceScore: Math.round(result.score * 10000) / 10000, // Round to 4 decimals
        text: result.chunk.text.substring(0, 500) + (result.chunk.text.length > 500 ? '...' : '')
      })),
      processingTime: totalProcessingTime,
      tokensUsed: totalTokensUsed
    };

    logger.stageComplete('MCP QUERY COMPLETE', {
      'Total Processing Time': `${totalProcessingTime}ms`,
      'Total Tokens Used': totalTokensUsed.toString(),
      'Sources Retrieved': similarityResults.length.toString(),
      'Response Length': completionResult.response.length.toString()
    });

    return successResponse({
      query: question,
      mcp: {
        id: mcpId,
        title: mcpData.title,
        fileName: mcpData.fileName
      },
      result: response
    });

  } catch (error) {
    logger.stageError('MCP query failed', error as Error);
    return errorResponse('Failed to process query', 500);
  }
});

/**
 * Log query to Firestore subcollection for analytics
 */
async function logQueryToFirestore(
  userId: string,
  mcpId: string,
  queryData: {
    question: string;
    answer: string;
    sourcesCount: number;
    tokensUsed: number;
    processingTime: number;
    bestSimilarityScore: number;
  }
): Promise<void> {
  try {
    const queryLogsRef = collection(db, 'mcps', userId, 'user_mcps', mcpId, 'queries');
    await addDoc(queryLogsRef, {
      ...queryData,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log query to Firestore:', error);
  }
}

/**
 * GET /api/mcp/query - Get MCP query history (optional feature)
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const mcpId = searchParams.get('mcpId');

    if (!mcpId) {
      return errorResponse('Missing mcpId parameter');
    }

    // Validate MCP exists
    const mcpRef = doc(db, 'mcps', req.userId, 'user_mcps', mcpId);
    const mcpDoc = await getDoc(mcpRef);

    if (!mcpDoc.exists()) {
      return errorResponse('MCP not found', 404);
    }

    const mcpData = mcpDoc.data();
    
    return successResponse({
      mcp: {
        id: mcpId,
        title: mcpData.title,
        fileName: mcpData.fileName,
        status: mcpData.status,
        numChunks: mcpData.numChunks,
        embeddingModel: mcpData.embeddingModel,
        createdAt: mcpData.createdAt?.toDate?.()?.toISOString() || mcpData.createdAt,
        processedAt: mcpData.processedAt?.toDate?.()?.toISOString() || mcpData.processedAt
      },
      queryable: mcpData.status === 'complete'
    });

  } catch (error) {
    console.error('MCP query info retrieval error:', error);
    return errorResponse('Failed to retrieve MCP query info', 500);
  }
});
