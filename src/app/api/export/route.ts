import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { exportMCPPipeline } from '@/lib/mcpExporter';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { z } from 'zod';

// Request schema validation
const ExportRequestSchema = z.object({
  pipelineId: z.string().min(1),
  format: z.enum(['zip', 'docker']).default('zip'),
  includeData: z.boolean().default(false)
});

interface ExportRequest {
  pipelineId: string;
  format: 'zip' | 'docker';
  includeData: boolean;
}

/**
 * POST /api/export - Export pipeline as MCP server package
 */
export const POST = withAuth(async (req) => {
  try {
    const body: ExportRequest = await req.json();
    const validation = ExportRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request data: ' + validation.error.message);
    }
    
    const { pipelineId, format, includeData } = validation.data;
    
    // Get pipeline metadata from Firestore
    const pipelineDocRef = doc(db, 'users', req.userId, 'pipelines', pipelineId);
    const pipelineDoc = await getDoc(pipelineDocRef);
    
    if (!pipelineDoc.exists()) {
      return errorResponse('Pipeline not found', 404);
    }
    
    const pipelineData = pipelineDoc.data();
    
    // Build pipeline object for export
    const pipeline = {
      id: pipelineId,
      metadata: {
        author: req.userId,
        createdAt: pipelineData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        fileName: pipelineData.fileName || 'pipeline.json',
        fileType: pipelineData.fileType || 'application/json',
        purpose: pipelineData.purpose || 'MCP Pipeline Export',
        vectorStore: 'pinecone',
        chunksCount: pipelineData.chunksCount || 0,
        chunkSize: 1000,
        overlap: 200
      },
      nodes: [
        {
          id: 'datasource',
          type: 'DataSource',
          data: {
            fileName: pipelineData.fileName,
            fileType: pipelineData.fileType,
            fileSize: pipelineData.fileSize || 0
          }
        },
        {
          id: 'chunker',
          type: 'Chunker',
          data: {
            chunkSize: 1000,
            overlap: 200,
            chunksCount: pipelineData.chunksCount || 0
          }
        },
        {
          id: 'embedder',
          type: 'Embedder',
          data: {
            model: 'text-embedding-ada-002',
            dimensions: 1536
          }
        },
        {
          id: 'vectorstore',
          type: 'VectorStore',
          data: {
            store: 'pinecone',
            indexedCount: pipelineData.vectorsCount || 0
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'datasource', target: 'chunker' },
        { id: 'e2-3', source: 'chunker', target: 'embedder' },
        { id: 'e3-4', source: 'embedder', target: 'vectorstore' }
      ]
    };
    
    // Export the pipeline
    const exportUrl = await exportMCPPipeline(pipeline, req.userId);
    
    return successResponse({
      exportUrl,
      pipelineId,
      format,
      message: 'Pipeline exported successfully'
    });
  } catch (error) {
    console.error('Export error:', error);
    return errorResponse('Failed to export pipeline', 500);
  }
});

/**
 * GET /api/export - List user's exports
 */
export const GET = withAuth(async (req) => {
  try {
    // This would typically query exports from Firestore
    // For now, return empty list as exports are handled via R2 URLs
    return successResponse({
      exports: [],
      count: 0,
      message: 'Export listing not yet implemented'
    });
  } catch (error) {
    console.error('Export listing error:', error);
    return errorResponse('Failed to list exports', 500);
  }
});
