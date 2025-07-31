import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ConfirmUploadRequest {
  fileId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  r2Key: string;
}

/**
 * POST /api/uploads/confirm - Confirm file upload and store metadata in Firestore
 */
export const POST = withAuth(async (req) => {
  try {
    const body: ConfirmUploadRequest = await req.json();
    const { fileId, fileName, fileSize, contentType, r2Key } = body;

    if (!fileId || !fileName || !fileSize || !contentType || !r2Key) {
      return errorResponse('Missing required fields');
    }

    // Store file metadata in Firestore
    const fileMetadata = {
      id: fileId,
      name: fileName,
      size: fileSize,
      mimeType: contentType,
      r2Key,
      userId: req.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'uploaded'
    };

    const fileDocRef = doc(db, 'users', req.userId, 'files', fileId);
    await setDoc(fileDocRef, fileMetadata);

    return successResponse({
      message: 'File upload confirmed',
      file: {
        id: fileId,
        name: fileName,
        size: fileSize,
        mimeType: contentType,
        createdAt: fileMetadata.createdAt
      }
    });
  } catch (error) {
    console.error('Upload confirmation error:', error);
    return errorResponse('Failed to confirm upload', 500);
  }
});
