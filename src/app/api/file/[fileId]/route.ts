import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/api-auth';
import { r2, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Initialize Firebase Admin services
const db = getFirestore();
const admin = getFirebaseAdmin();
const storage = admin.storage();

// Helper function to concatenate stream chunks into a buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { fileId: string } }
) {
  try {
    // Get file ID from URL params (properly awaited to fix Next.js warning)
    const params = await context.params;
    const fileId = params.fileId;
    if (!fileId) {
      return NextResponse.json({ message: 'File ID is required' }, { status: 400 });
    }
    
    console.log(`File request for ID: ${fileId}`);
    
    // Check if this is a direct file download request
    const isDownload = request.nextUrl.searchParams.has('download');
    
    // Authenticate request
    const auth = await authenticateRequest(request);
    
    // If authentication failed
    if (!auth.authenticated) {
      console.log('Authentication failed');
      return auth.response;
    }
    
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found in token' }, { status: 401 });
    }
    
    console.log(`Authenticated as user: ${userId}`);

    // Get file document from Firestore
    // Note: Collection might be 'files' or 'uploads' based on previous code, using 'uploads' as in original
    const fileRef = db.collection('uploads').doc(fileId);
    const fileDoc = await fileRef.get();
    
    if (!fileDoc.exists) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    const fileData = fileDoc.data();
    
    // Check if file data exists
    if (!fileData) {
      return NextResponse.json({ message: 'File data not found' }, { status: 404 });
    }
    
    // Check if this file belongs to the requesting user or if it's a server auth request
    const isServerAuth = auth.decodedToken?.claims?.server === true;
    if (fileData.userId !== userId && !isServerAuth) {
      console.log('Authorization failed: File belongs to another user');
      return NextResponse.json({ message: 'You are not authorized to access this file' }, { status: 403 });
    }
    
    // For metadata requests, return the file metadata
    if (!isDownload) {
      return NextResponse.json({
        fileId: fileDoc.id,
        fileName: fileData.fileName || '',
        fileType: fileData.fileType || '',
        createdAt: fileData.createdAt || null,
        size: fileData.size || 0
      });
    }
    
    // Handle file download request
    console.log(`API endpoint: Attempting to download file ${fileId} from storage`);
    
    // First check if we have the content directly in Firestore
    if (fileData.content) {
      console.log('File content found directly in Firestore, returning it');
      // Return base64 content as binary data with appropriate content type
      const binaryContent = Buffer.from(fileData.content, 'base64');
      return new NextResponse(binaryContent, {
        headers: {
          'Content-Type': fileData.fileType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileData.fileName || 'download'}"`
        }
      });
    }
    
    // Try to get the file from Cloudflare R2 storage (primary storage)
    console.log('Attempting to download file directly from Cloudflare R2');
    
    // Try different key patterns for R2
    const r2KeyOptions = [
      fileData.r2Key, // Direct key stored in metadata
      `files/${fileId}`, // Common pattern
      `uploads/${fileId}`, // Alternative pattern
      `${fileId}` // Plain file ID
    ];
    
    // Try each R2 key option
    for (const r2Key of r2KeyOptions) {
      if (!r2Key) continue; // Skip undefined keys
      
      try {
        console.log(`Trying R2 with key: ${r2Key}`);
        
        const getObjectCommand = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key
        });
        
        const r2Response = await r2.send(getObjectCommand);
        
        if (r2Response && r2Response.Body) {
          console.log(`Successfully retrieved file from R2 with key: ${r2Key}`);
          
          // Convert the readable stream to a buffer
          const fileBuffer = await streamToBuffer(r2Response.Body as Readable);
          
          // Return the file with appropriate headers
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': fileData.fileType || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileData.fileName || 'download'}"`
            }
          });
        }
      } catch (error) {
        console.log(`R2 attempt with key ${r2Key} failed:`, error instanceof Error ? error.message : 'Unknown error');
        // Continue to try next key option
      }
    }
    
    // No fallbacks - if R2 access failed, throw a clear error
    console.error('R2 access failed - no fallback mechanisms allowed');
    throw new Error(`File access failed: Could not retrieve file ${fileId} from R2 storage. Ensure R2 is properly configured.`);
    
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
  context: { params: { fileId: string } }
) {
  try {
    // Get file ID from URL params (properly awaited to fix Next.js warning)
    const params = await context.params;
    const fileId = params.fileId;
    if (!fileId) {
      return NextResponse.json({ message: 'File ID is required' }, { status: 400 });
    }

    // Authenticate request
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return auth.response;
    }
    
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found in token' }, { status: 401 });
    }

    // Get file document from Firestore
    const fileRef = db.collection('uploads').doc(fileId);
    const fileDoc = await fileRef.get();
    
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
    batch.delete(fileRef);
    
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
