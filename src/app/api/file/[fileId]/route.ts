import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { r2, R2_BUCKET } from '@/lib/r2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize Firebase Admin services
const db = getFirestore();
const admin = getFirebaseAdmin();

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

export async function DELETE(
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
      return NextResponse.json({ message: 'Unauthorized: You do not have access to delete this file' }, { status: 403 });
    }

    // Start a batch to delete all related documents
    const batch = db.batch();
    
    // 1. Delete the file from the uploads collection
    batch.delete(db.collection('uploads').doc(fileId));
    
    // 2. Delete the pipeline if it exists
    const pipelineRef = db.collection('pipelines').doc(fileId);
    const pipelineDoc = await pipelineRef.get();
    if (pipelineDoc.exists) {
      batch.delete(pipelineRef);
    }
    
    // 3. Delete embeddings if they exist
    const embeddingsRef = db.collection('embeddings').doc(fileId);
    const embeddingsDoc = await embeddingsRef.get();
    if (embeddingsDoc.exists) {
      // Get all chunks in the subcollection
      const chunksSnapshot = await embeddingsRef.collection('chunks').get();
      
      // Add each chunk document to the batch for deletion
      chunksSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete the main embeddings document
      batch.delete(embeddingsRef);
    }
    
    // 4. Delete the file from R2 storage if r2Key exists
    if (fileData.r2Key) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: fileData.r2Key
          })
        );
        console.log(`Deleted file from R2: ${fileData.r2Key}`);
      } catch (r2Error) {
        console.error('Error deleting file from R2:', r2Error);
        // Continue with Firestore deletion even if R2 deletion fails
      }
    }
    
    // Commit all the Firestore deletions
    await batch.commit();
    
    return NextResponse.json({
      message: 'File deleted successfully',
      fileId
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ message: `Failed to delete file: ${message}` }, { status: 500 });
  }
}
