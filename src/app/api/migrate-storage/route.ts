import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '@/lib/firebase';

// Initialize Firebase Admin services
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * API endpoint to migrate files from Firebase Storage to Firestore
 * This is a server-side implementation of the migration process
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: Invalid user' }, { status: 401 });
    }

    // Get request body for specific file ID or all files
    const body = await request.json();
    const fileId = body.fileId; // Optional: specific file to migrate
    
    if (fileId) {
      // Migrate a specific file
      const fileDoc = await db.collection('uploads').doc(fileId).get();
      
      if (!fileDoc.exists) {
        return NextResponse.json({ message: 'File not found' }, { status: 404 });
      }
      
      const fileData = fileDoc.data();
      
      // Verify ownership
      if (fileData?.userId !== userId) {
        return NextResponse.json({ message: 'Unauthorized: Not your file' }, { status: 403 });
      }
      
      // Skip if already migrated
      if (fileData.fileContent) {
        return NextResponse.json({ 
          message: 'File already migrated',
          fileId,
          status: 'already_migrated'
        });
      }
      
      if (!fileData.fileUrl || !fileData.filePath) {
        return NextResponse.json({ 
          message: 'File has no Storage URL to migrate from',
          fileId,
          status: 'no_url'
        }, { status: 400 });
      }
      
      try {
        // Implement server-side fetch of file content
        const response = await fetch(fileData.fileUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file from Storage: ${response.statusText}`);
        }
        
        let fileContent = '';
        
        // Process content based on file type
        if (fileData.fileType === 'application/pdf') {
          // For binary files, convert to Base64
          const buffer = Buffer.from(await response.arrayBuffer());
          fileContent = buffer.toString('base64');
        } else {
          // For text files, get as string
          fileContent = await response.text();
        }
        
        // Update the Firestore document with file content
        await db.collection('uploads').doc(fileId).update({
          fileContent,
          migratedAt: new Date(),
          status: 'migrated'
        });
        
        return NextResponse.json({
          message: 'File successfully migrated',
          fileId,
          status: 'success'
        });
      } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
          message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fileId,
          status: 'failed'
        }, { status: 500 });
      }
    } else {
      // Migrate all files for this user (batch operation)
      const snapshot = await db.collection('uploads')
        .where('userId', '==', userId)
        .where('fileContent', '==', null)
        .get();
      
      const total = snapshot.size;
      let migrated = 0;
      let failed = 0;
      
      if (total === 0) {
        return NextResponse.json({ 
          message: 'No files to migrate',
          stats: { total, migrated, failed }
        });
      }
      
      // Process each file (for server-side batch operations, we need to be careful about timeouts)
      // In a production environment, this would likely be handled by a background job
      const results = [];
      
      for (const doc of snapshot.docs) {
        const fileData = doc.data();
        
        // Skip if no URL or already has content
        if (!fileData.fileUrl || fileData.fileContent) {
          continue;
        }
        
        try {
          // Fetch and process file content
          const response = await fetch(fileData.fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch ${doc.id}: ${response.statusText}`);
          }
          
          let fileContent = '';
          
          // Process content based on file type
          if (fileData.fileType === 'application/pdf') {
            // For binary files, convert to Base64
            const buffer = Buffer.from(await response.arrayBuffer());
            fileContent = buffer.toString('base64');
          } else {
            // For text files, get as string
            fileContent = await response.text();
          }
          
          // Update the Firestore document
          await db.collection('uploads').doc(doc.id).update({
            fileContent,
            migratedAt: new Date(),
            status: 'migrated'
          });
          
          results.push({
            fileId: doc.id,
            status: 'success'
          });
          
          migrated++;
        } catch (error) {
          console.error(`Failed to migrate ${doc.id}:`, error);
          results.push({
            fileId: doc.id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          failed++;
        }
      }
      
      return NextResponse.json({
        message: `Migration completed. Total: ${total}, Migrated: ${migrated}, Failed: ${failed}`,
        stats: { total, migrated, failed },
        results
      });
    }
  } catch (error) {
    console.error('Migration error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ message: `Migration failed: ${message}` }, { status: 500 });
  }
}
