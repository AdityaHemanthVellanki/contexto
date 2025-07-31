import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { deleteFile } from '@/lib/r2-client';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * GET /api/uploads/[fileId] - Get file metadata
 */
export const GET = withAuth(async (req, context) => {
  try {
    const { fileId } = context?.params || {};
    
    if (!fileId) {
      return errorResponse('File ID is required', 400);
    }
    
    const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
    const fileDoc = await getDoc(fileDocRef);
    
    if (!fileDoc.exists()) {
      return errorResponse('File not found', 404);
    }
    
    const fileData = fileDoc.data();
    return successResponse({
      id: fileDoc.id,
      ...fileData,
      uploadedAt: fileData.uploadedAt?.toDate?.()?.toISOString() || fileData.uploadedAt
    });
  } catch (error) {
    console.error('Get file error:', error);
    return errorResponse('Failed to get file', 500);
  }
});

/**
 * DELETE /api/uploads/[fileId] - Delete file and metadata
 */
export const DELETE = withAuth(async (req, context) => {
  try {
    const { fileId } = context?.params || {};
    
    if (!fileId) {
      return errorResponse('File ID is required', 400);
    }
    
    // Get file metadata first
    const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
    const fileDoc = await getDoc(fileDocRef);
    
    if (!fileDoc.exists()) {
      return errorResponse('File not found', 404);
    }
    
    const fileData = fileDoc.data();
    const { r2Key } = fileData;
    
    // Delete from R2 storage
    try {
      await deleteFile(r2Key);
    } catch (r2Error) {
      console.warn('Failed to delete from R2, continuing with metadata deletion:', r2Error);
    }
    
    // Delete metadata from Firestore
    await deleteDoc(fileDocRef);
    
    return successResponse({
      message: 'File deleted successfully',
      fileId
    });
  } catch (error) {
    console.error('Delete file error:', error);
    return errorResponse('Failed to delete file', 500);
  }
});
