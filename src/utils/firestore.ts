import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc, 
  setDoc, 
  doc, 
  addDoc, 
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Define types for collections
export interface Pipeline {
  id?: string;
  userId: string;
  name: string;
  graph: any; // The graph data structure (nodes, edges, etc.)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UsageMetric {
  id?: string;
  userId: string;
  callType: string;
  promptTokens: number;
  completionTokens: number;
  timestamp?: Timestamp;
}

/**
 * Save a pipeline to Firestore
 * @param userId The user ID
 * @param pipeline The pipeline data to save
 * @returns The ID of the saved pipeline
 */
export const savePipeline = async (userId: string, pipeline: Omit<Pipeline, 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const timestamp = serverTimestamp();
    
    // If the pipeline has an ID, update it; otherwise, create a new one
    if (pipeline.id) {
      const pipelineRef = doc(db, 'pipelines', pipeline.id);
      await setDoc(pipelineRef, {
        ...pipeline,
        userId,
        updatedAt: timestamp
      }, { merge: true });
      return pipeline.id;
    } else {
      // Create a new document with a generated ID
      const pipelineRef = doc(collection(db, 'pipelines'));
      await setDoc(pipelineRef, {
        ...pipeline,
        userId,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      return pipelineRef.id;
    }
  } catch (error) {
    console.error('Error saving pipeline:', error);
    throw error;
  }
};

/**
 * List all pipelines for a user
 * @param userId The user ID
 * @returns Array of pipelines
 */
export const listPipelines = async (userId: string): Promise<Pipeline[]> => {
  try {
    const pipelinesRef = collection(db, 'pipelines');
    const q = query(
      pipelinesRef,
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        name: data.name,
        graph: data.graph,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    console.error('Error listing pipelines:', error);
    throw error;
  }
};

/**
 * Load a specific pipeline by ID
 * @param id The pipeline ID
 * @returns The pipeline data or null if not found
 */
export const loadPipeline = async (id: string): Promise<Pipeline | null> => {
  try {
    const pipelineRef = doc(db, 'pipelines', id);
    const pipelineSnap = await getDoc(pipelineRef);
    
    if (pipelineSnap.exists()) {
      const data = pipelineSnap.data();
      return {
        id: pipelineSnap.id,
        userId: data.userId,
        name: data.name,
        graph: data.graph,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading pipeline:', error);
    throw error;
  }
};

/**
 * Delete a pipeline by ID
 * @param id The pipeline ID
 */
export const deletePipeline = async (id: string): Promise<void> => {
  try {
    const pipelineRef = doc(db, 'pipelines', id);
    await setDoc(pipelineRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    throw error;
  }
};

/**
 * Log API usage metrics
 * @param userId The user ID
 * @param callType The type of API call (e.g., 'embedding', 'completion')
 * @param usage The usage metrics (tokens)
 * @returns The ID of the created usage log
 */
export const logUsage = async (
  userId: string,
  callType: string,
  usage: { promptTokens: number; completionTokens: number }
): Promise<string> => {
  try {
    const usageRef = collection(db, 'usage_metrics');
    const docRef = await addDoc(usageRef, {
      userId,
      callType,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      timestamp: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error logging usage:', error);
    throw error;
  }
};

/**
 * Get usage metrics for a user
 * @param userId The user ID
 * @returns Array of usage metrics
 */
export const getUserUsageMetrics = async (userId: string): Promise<UsageMetric[]> => {
  try {
    const usageRef = collection(db, 'usage_metrics');
    const q = query(
      usageRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        callType: data.callType,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        timestamp: data.timestamp
      };
    });
  } catch (error) {
    console.error('Error getting usage metrics:', error);
    throw error;
  }
};
