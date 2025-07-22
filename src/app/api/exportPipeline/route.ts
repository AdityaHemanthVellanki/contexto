import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';

// Initialize Firestore
const getDb = async () => await getFirestore();

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using our helper
    const authResult = await authenticateRequest(request);
    
    if (!authResult.authenticated) {
      // authenticateRequest already returns a proper NextResponse for errors
      return authResult.response;
    }
    
    const userId = authResult.userId;
    
    // Parse the request body
    const body = await request.json();
    const { pipelineId } = body;
    
    if (!pipelineId) {
      // If no pipelineId is provided, return a sample pipeline for the chat interface
      return NextResponse.json({
        success: true,
        pipeline: generateSamplePipeline()
      });
    }
    
    // Fetch the pipeline from Firestore using Admin SDK
    try {
      const db = await getDb();
      const pipelineRef = db.collection('pipelines').doc(pipelineId);
      const pipelineDoc = await pipelineRef.get();
      
      if (!pipelineDoc.exists) {
        return NextResponse.json({
          message: 'Pipeline not found'
        }, { status: 404 });
      }
      
      // Verify pipeline ownership
      const pipelineData = pipelineDoc.data();
      if (!pipelineData || pipelineData.userId !== userId) {
        return NextResponse.json({
          message: 'Unauthorized: You do not have permission to export this pipeline'
        }, { status: 403 });
      }
      
      // Return the pipeline data
      return NextResponse.json({
        success: true,
        pipeline: pipelineData.graph || pipelineData
      });
      
    } catch (dbError) {
      console.error('Database error when fetching pipeline:', dbError);
      return NextResponse.json({
        message: 'Failed to fetch pipeline data',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error exporting pipeline:', error);
    return NextResponse.json({ 
      message: 'Failed to export pipeline',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Helper function to generate a sample pipeline for the chat interface
function generateSamplePipeline() {
  return {
    name: "Chat-Centric RAG Pipeline",
    description: "A Retrieval-Augmented Generation pipeline for the chat interface",
    version: "1.0.0",
    nodes: [
      {
        id: "documentLoader",
        type: "documentLoader",
        position: { x: 100, y: 100 },
        data: {
          name: "Document Loader",
          description: "Loads documents from various sources"
        }
      },
      {
        id: "textSplitter",
        type: "textSplitter",
        position: { x: 100, y: 200 },
        data: {
          name: "Text Splitter",
          description: "Splits text into chunks",
          chunkSize: 1000,
          chunkOverlap: 200
        }
      },
      {
        id: "embeddings",
        type: "embeddings",
        position: { x: 100, y: 300 },
        data: {
          name: "Embeddings",
          description: "Creates vector embeddings from text chunks",
          model: "openai:text-embedding-ada-002"
        }
      },
      {
        id: "vectorStore",
        type: "vectorStore",
        position: { x: 100, y: 400 },
        data: {
          name: "Vector Store",
          description: "Stores vector embeddings for retrieval",
          type: "memory"
        }
      },
      {
        id: "retriever",
        type: "retriever",
        position: { x: 100, y: 500 },
        data: {
          name: "Retriever",
          description: "Retrieves relevant documents based on query",
          k: 3
        }
      },
      {
        id: "llm",
        type: "llm",
        position: { x: 100, y: 600 },
        data: {
          name: "Language Model",
          description: "Generates responses based on context",
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          maxTokens: 1000
        }
      }
    ],
    edges: [
      {
        source: "documentLoader",
        target: "textSplitter",
        id: "edge-1"
      },
      {
        source: "textSplitter",
        target: "embeddings",
        id: "edge-2"
      },
      {
        source: "embeddings",
        target: "vectorStore",
        id: "edge-3"
      },
      {
        source: "vectorStore",
        target: "retriever",
        id: "edge-4"
      },
      {
        source: "retriever",
        target: "llm",
        id: "edge-5"
      }
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      format: "MCP-compatible"
    }
  };
}
