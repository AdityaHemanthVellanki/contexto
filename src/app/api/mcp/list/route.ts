import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface MCPListItem {
  id: string;
  title: string;
  fileName: string;
  description?: string;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  createdAt: string;
  processedAt?: string;
  numChunks?: number;
  embeddingModel: string;
  error?: string;
}

/**
 * GET /api/mcp/list - List user's MCPs with filtering and pagination
 */
export const GET = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const mcpsRef = collection(db, 'mcps', req.userId, 'user_mcps');
    let mcpQuery = query(mcpsRef, orderBy('createdAt', 'desc'));

    // Apply status filter if provided
    if (status && ['uploading', 'processing', 'complete', 'error'].includes(status)) {
      mcpQuery = query(mcpsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
    }

    const mcpsSnapshot = await getDocs(mcpQuery);
    
    // Convert to array and apply pagination
    const allMcps = mcpsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        fileName: data.fileName,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        processedAt: data.processedAt?.toDate?.()?.toISOString() || data.processedAt,
        numChunks: data.numChunks,
        embeddingModel: data.embeddingModel,
        error: data.error
      } as MCPListItem;
    });

    // Apply pagination
    const paginatedMcps = allMcps.slice(offset, offset + limit);
    
    // Calculate stats
    const stats = {
      total: allMcps.length,
      complete: allMcps.filter(mcp => mcp.status === 'complete').length,
      processing: allMcps.filter(mcp => mcp.status === 'processing').length,
      error: allMcps.filter(mcp => mcp.status === 'error').length
    };

    return successResponse({
      mcps: paginatedMcps,
      pagination: {
        total: allMcps.length,
        limit,
        offset,
        hasMore: offset + limit < allMcps.length
      },
      stats
    });

  } catch (error) {
    console.error('MCP list retrieval error:', error);
    return errorResponse('Failed to retrieve MCPs', 500);
  }
});

/**
 * DELETE /api/mcp/list - Delete an MCP and its associated data
 */
export const DELETE = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const mcpId = searchParams.get('mcpId');

    if (!mcpId) {
      return errorResponse('Missing mcpId parameter');
    }

    // TODO: Implement MCP deletion
    // 1. Delete vectors from Pinecone
    // 2. Delete file from R2
    // 3. Delete metadata from Firestore
    
    return errorResponse('MCP deletion not yet implemented', 501);

  } catch (error) {
    console.error('MCP deletion error:', error);
    return errorResponse('Failed to delete MCP', 500);
  }
});
