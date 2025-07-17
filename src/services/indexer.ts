import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Indexer node - Store embeddings and chunks in Firestore
 * 
 * @param fileId The file ID to associate embeddings with
 * @param embeddings Array of embedding vectors
 * @param chunks Array of text chunks
 * @returns Promise that resolves when indexing is complete
 */
export async function runIndexer(
  fileId: string,
  embeddings: number[][],
  chunks: string[]
): Promise<void> {
  if (!fileId) {
    throw new Error('Indexer failed: Missing fileId parameter');
  }

  if (!embeddings || embeddings.length === 0) {
    throw new Error('Indexer failed: No embeddings provided');
  }

  if (!chunks || chunks.length === 0 || chunks.length !== embeddings.length) {
    throw new Error(`Indexer failed: Chunks array length (${chunks?.length}) doesn't match embeddings length (${embeddings.length})`);
  }

  try {
    const db = getFirestore();
    const batch = db.batch();
    const embeddingsCollection = db.collection(`uploads/${fileId}/embeddings`);
    
    console.log(`Indexing ${embeddings.length} embeddings for file ${fileId}`);
    
    // Store each embedding with its corresponding chunk text
    for (let i = 0; i < embeddings.length; i++) {
      const embeddingRef = embeddingsCollection.doc(i.toString());
      batch.set(embeddingRef, {
        vector: embeddings[i],
        text: chunks[i],
        createdAt: FieldValue.serverTimestamp()
      });
    }
    
    // Update the parent file document with embedding count and last updated
    const fileRef = db.collection('uploads').doc(fileId);
    batch.update(fileRef, {
      embeddingCount: embeddings.length,
      lastIndexed: FieldValue.serverTimestamp()
    });
    
    // Commit all documents in a single batch
    await batch.commit();
    
    console.log(`Successfully indexed ${embeddings.length} embeddings for file ${fileId}`);
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Indexer failed: ${e.message}`);
    }
    throw new Error('Indexer failed: Unknown error');
  }
}
