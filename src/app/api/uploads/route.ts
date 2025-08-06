import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { generateUploadUrl, generateFileKey, validateFile } from '@/lib/r2-client';
import { doc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface UploadRequest {
  fileName: string;
  fileSize: number;
  contentType: string;
}

/**
 * POST /api/uploads - Generate signed upload URL for file upload to R2
 */
export const POST = withAuth(async (req) => {
  try {
    const body: UploadRequest = await req.json();
    const { fileName, fileSize, contentType } = body;

    if (!fileName || !fileSize || !contentType) {
      return errorResponse('Missing required fields: fileName, fileSize, contentType');
    }

    // Validate file parameters
    const validation = validateFile({ name: fileName, size: fileSize, type: contentType } as File);
    if (!validation.valid) {
      return errorResponse(validation.error!);
    }

    // Generate unique file ID and R2 key
    const fileId = uuidv4();
    const r2Key = generateFileKey(req.userId, fileId, fileName);

    // Generate signed upload URL
    const uploadUrl = await generateUploadUrl(r2Key, contentType);

    return successResponse({
      fileId,
      uploadUrl,
      r2Key
    });
  } catch (error) {
    console.error('Upload URL generation error:', error);
    return errorResponse('Failed to generate upload URL', 500);
  }
});

/**
 * GET /api/uploads - List user's uploaded files
 */
export const GET = withAuth(async (req) => {
  try {
    const filesRef = collection(db, 'users', req.userId, 'files');
    const filesSnapshot = await getDocs(query(filesRef, orderBy('uploadedAt', 'desc')));
    
    const files = filesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate?.()?.toISOString() || doc.data().uploadedAt
    }));
    
    return successResponse({
      files,
      count: files.length
    });
  } catch (error) {
    console.error('File listing error:', error);
    return errorResponse('Failed to list files', 500);
  }
});
