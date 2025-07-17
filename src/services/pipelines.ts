import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PipelineData {
  id?: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  settings: any;
  metadata: {
    createdAt: string;
    lastModified: string;
    version: string;
  };
  userId?: string;
}

export interface SavedPipeline extends PipelineData {
  id: string;
  userId: string;
  createdAt: Timestamp;
  lastModified: Timestamp;
}

/**
 * Save a pipeline to Firebase Firestore
 */
export async function savePipelineToFirebase(
  userId: string, 
  pipelineData: Omit<PipelineData, 'id' | 'userId'>
): Promise<string> {
  try {
    const pipelinesRef = collection(db, 'pipelines');
    const now = Timestamp.now();
    
    const docData = {
      ...pipelineData,
      userId,
      createdAt: now,
      lastModified: now,
      metadata: {
        ...pipelineData.metadata,
        createdAt: now.toDate().toISOString(),
        lastModified: now.toDate().toISOString()
      }
    };

    const docRef = await addDoc(pipelinesRef, docData);
    console.log('Pipeline saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving pipeline:', error);
    throw new Error('Failed to save pipeline to database');
  }
}

/**
 * Update an existing pipeline in Firebase Firestore
 */
export async function updatePipelineInFirebase(
  pipelineId: string,
  userId: string,
  updates: Partial<Omit<PipelineData, 'id' | 'userId'>>
): Promise<void> {
  try {
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    const now = Timestamp.now();
    
    const updateData = {
      ...updates,
      lastModified: now,
      metadata: {
        ...updates.metadata,
        lastModified: now.toDate().toISOString()
      }
    };

    await updateDoc(pipelineRef, updateData);
    console.log('Pipeline updated:', pipelineId);
  } catch (error) {
    console.error('Error updating pipeline:', error);
    throw new Error('Failed to update pipeline in database');
  }
}

/**
 * Delete a pipeline from Firebase Firestore
 */
export async function deletePipelineFromFirebase(
  pipelineId: string,
  userId: string
): Promise<void> {
  try {
    // First verify the pipeline belongs to the user
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    const pipelineDoc = await getDoc(pipelineRef);
    
    if (!pipelineDoc.exists()) {
      throw new Error('Pipeline not found');
    }
    
    const pipelineData = pipelineDoc.data() as SavedPipeline;
    if (pipelineData.userId !== userId) {
      throw new Error('Unauthorized: Pipeline does not belong to user');
    }

    await deleteDoc(pipelineRef);
    console.log('Pipeline deleted:', pipelineId);
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    throw new Error('Failed to delete pipeline from database');
  }
}

/**
 * Get all pipelines for a user from Firebase Firestore
 */
export async function getUserPipelinesFromFirebase(
  userId: string,
  limitCount: number = 50
): Promise<SavedPipeline[]> {
  try {
    const pipelinesRef = collection(db, 'pipelines');
    const q = query(
      pipelinesRef,
      where('userId', '==', userId),
      orderBy('lastModified', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const pipelines: SavedPipeline[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      pipelines.push({
        ...data,
        id: doc.id
      } as SavedPipeline);
    });

    console.log(`Retrieved ${pipelines.length} pipelines for user:`, userId);
    return pipelines;
  } catch (error) {
    console.error('Error fetching user pipelines:', error);
    throw new Error('Failed to fetch pipelines from database');
  }
}

/**
 * Get a specific pipeline by ID from Firebase Firestore
 */
export async function getPipelineFromFirebase(
  pipelineId: string,
  userId: string
): Promise<SavedPipeline | null> {
  try {
    const pipelineRef = doc(db, 'pipelines', pipelineId);
    const pipelineDoc = await getDoc(pipelineRef);
    
    if (!pipelineDoc.exists()) {
      return null;
    }
    
    const pipelineData = pipelineDoc.data() as SavedPipeline;
    
    // Verify the pipeline belongs to the user
    if (pipelineData.userId !== userId) {
      throw new Error('Unauthorized: Pipeline does not belong to user');
    }

    return {
      ...pipelineData,
      id: pipelineDoc.id
    };
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    throw new Error('Failed to fetch pipeline from database');
  }
}

/**
 * Search pipelines by name for a user
 */
export async function searchUserPipelines(
  userId: string,
  searchTerm: string,
  limitCount: number = 20
): Promise<SavedPipeline[]> {
  try {
    const pipelinesRef = collection(db, 'pipelines');
    const q = query(
      pipelinesRef,
      where('userId', '==', userId),
      orderBy('lastModified', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const pipelines: SavedPipeline[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as SavedPipeline;
      // Client-side filtering by name (Firestore doesn't support full-text search)
      if (data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          data.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        pipelines.push({
          ...data,
          id: doc.id
        });
      }
    });

    console.log(`Found ${pipelines.length} pipelines matching "${searchTerm}"`);
    return pipelines;
  } catch (error) {
    console.error('Error searching pipelines:', error);
    throw new Error('Failed to search pipelines in database');
  }
}

/**
 * Duplicate a pipeline for a user
 */
export async function duplicatePipeline(
  pipelineId: string,
  userId: string,
  newName?: string
): Promise<string> {
  try {
    // First get the original pipeline
    const originalPipeline = await getPipelineFromFirebase(pipelineId, userId);
    if (!originalPipeline) {
      throw new Error('Original pipeline not found');
    }

    // Create a copy with updated metadata
    const duplicatedPipeline: Omit<PipelineData, 'id' | 'userId'> = {
      name: newName || `${originalPipeline.name} (Copy)`,
      description: `Copy of: ${originalPipeline.description}`,
      nodes: JSON.parse(JSON.stringify(originalPipeline.nodes)), // Deep copy
      edges: JSON.parse(JSON.stringify(originalPipeline.edges)), // Deep copy
      settings: JSON.parse(JSON.stringify(originalPipeline.settings)), // Deep copy
      metadata: {
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: originalPipeline.metadata.version
      }
    };

    // Save the duplicated pipeline
    const newPipelineId = await savePipelineToFirebase(userId, duplicatedPipeline);
    console.log('Pipeline duplicated:', pipelineId, '->', newPipelineId);
    return newPipelineId;
  } catch (error) {
    console.error('Error duplicating pipeline:', error);
    throw new Error('Failed to duplicate pipeline');
  }
}
