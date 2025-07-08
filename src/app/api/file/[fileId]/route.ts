import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';

// Initialize Firebase Admin services
const db = getFirestore();

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    // Get file ID from URL params
    const { fileId } = params;
    if (!fileId) {
      return NextResponse.json({ message: 'File ID is required' }, { status: 400 });
    }

    // Authenticate request
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return auth.response;
    }
    
    const userId = auth.userId;

    // Get file document from Firestore
    const fileDoc = await db.collection('uploads').doc(fileId).get();
    
    if (!fileDoc.exists) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    const fileData = fileDoc.data();
    
    // Check if file data exists
    if (!fileData) {
      return NextResponse.json({ message: 'File data not found' }, { status: 404 });
    }
    
    // Check if this file belongs to the requesting user
    if (fileData.userId !== userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not have access to this file' }, { status: 403 });
    }

    // Return the file content and metadata
    return NextResponse.json({
      fileId: fileDoc.id,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileContent: fileData.fileContent,
      uploadedAt: fileData.uploadedAt ? fileData.uploadedAt.toDate() : new Date(),
      fileSize: fileData.fileSize || 0,
      status: fileData.status || 'ready'
    });

  } catch (error) {
    console.error('Error fetching file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check if it's an auth error
    if (message.includes('auth')) {
      return NextResponse.json({ message: `Unauthorized: ${message}` }, { status: 401 });
    }
    
    return NextResponse.json({ message: `Failed to fetch file: ${message}` }, { status: 500 });
  }
}
