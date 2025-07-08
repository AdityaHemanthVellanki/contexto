/**
 * Utility for migrating existing Firebase Storage files to Firestore-only storage
 * 
 * This helper can be used to:
 * 1. Fetch existing files from Firebase Storage
 * 2. Read their content as Base64 or text
 * 3. Store them directly in Firestore documents
 * 4. Update references in the Firestore database
 */

import { app } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, query, where, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Function to migrate a single file from Storage to Firestore
export async function migrateFileToFirestore(fileId: string, userId: string): Promise<boolean> {
  try {
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.error('User not authenticated or user ID mismatch');
      return false;
    }
    
    // Get the file metadata from Firestore
    const fileDocRef = doc(db, 'uploads', fileId);
    const fileDoc = await getDoc(fileDocRef);
    
    if (!fileDoc.exists()) {
      console.error('File not found in Firestore:', fileId);
      return false;
    }
    
    const fileData = fileDoc.data();
    
    // Fetch the file content from the Storage URL
    if (!fileData.fileUrl) {
      console.error('File URL not found for file:', fileId);
      return false;
    }
    
    // Fetch the file content
    const response = await fetch(fileData.fileUrl);
    
    if (!response.ok) {
      console.error('Failed to fetch file from Storage:', fileData.fileUrl);
      return false;
    }
    
    let fileContent = '';
    const contentType = fileData.fileType || 'text/plain';
    
    // Process content based on file type
    if (contentType === 'application/pdf') {
      // For binary files, convert to Base64
      const blob = await response.blob();
      fileContent = await blobToBase64(blob);
    } else {
      // For text files, get as string
      fileContent = await response.text();
    }
    
    // Update the Firestore document with the file content
    await updateDoc(fileDocRef, {
      fileContent,
      // Remove Storage-specific fields
      fileUrl: null,
      filePath: null,
      // Add timestamp for migration
      migratedAt: new Date(),
      status: 'migrated'
    });
    
    console.log('Successfully migrated file to Firestore:', fileId);
    return true;
  } catch (error) {
    console.error('Error migrating file to Firestore:', error);
    return false;
  }
}

// Helper function to convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data:application/...;base64, prefix
      const base64Content = base64String.split(',')[1] || base64String;
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Batch migrate all files for a user
export async function batchMigrateUserFiles(userId: string): Promise<{total: number, migrated: number, failed: number}> {
  try {
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.error('User not authenticated or user ID mismatch');
      return { total: 0, migrated: 0, failed: 0 };
    }
    
    // Query all files for this user that haven't been migrated yet
    const filesRef = collection(db, 'uploads');
    const q = query(
      filesRef, 
      where('userId', '==', userId),
      where('fileContent', '==', null)
    );
    
    const snapshot = await getDocs(q);
    const total = snapshot.docs.length;
    
    if (total === 0) {
      console.log('No files to migrate for user:', userId);
      return { total: 0, migrated: 0, failed: 0 };
    }
    
    console.log(`Found ${total} files to migrate for user ${userId}`);
    
    let migrated = 0;
    let failed = 0;
    
    // Process each file
    for (const fileDoc of snapshot.docs) {
      const success = await migrateFileToFirestore(fileDoc.id, userId);
      if (success) {
        migrated++;
      } else {
        failed++;
      }
    }
    
    console.log(`Migration complete for user ${userId}. Total: ${total}, Migrated: ${migrated}, Failed: ${failed}`);
    return { total, migrated, failed };
  } catch (error) {
    console.error('Error in batch migration:', error);
    return { total: 0, migrated: 0, failed: 0 };
  }
}
