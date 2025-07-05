import { auth, db } from './firebase';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

// Define Pipeline interface
export interface Pipeline {
  id: string;
  userId: string;
  name: string;
  graph: {
    nodes: Node[];
    edges: Edge[];
  };
  createdAt?: any;
  updatedAt?: any;
  deleted?: boolean;
}

// Collection references
const pipelinesCollection = 'pipelines';

// Create or update a pipeline
export const savePipeline = async (name: string, nodes: Node[], edges: Edge[], pipelineId?: string): Promise<Pipeline> => {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    // Create pipeline object
    const id = pipelineId || uuidv4();
    
    const pipelineData: Pipeline = {
      id,
      userId: user.uid,
      name,
      graph: { nodes, edges },
      updatedAt: serverTimestamp(),
    };
    
    // If it's a new pipeline, add createdAt
    if (!pipelineId) {
      pipelineData.createdAt = serverTimestamp();
    }
    
    // Save to Firestore
    const pipelineRef = doc(db, pipelinesCollection, id);
    
    // Convert to plain object for Firestore
    const firestoreData: DocumentData = {
      id,
      userId: user.uid,
      name,
      graph: { 
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges))
      },
      updatedAt: serverTimestamp(),
      deleted: false
    };
    
    // If it's a new pipeline, add createdAt
    if (!pipelineId) {
      firestoreData.createdAt = serverTimestamp();
    }
    
    if (pipelineId) {
      // Update existing pipeline
      await updateDoc(pipelineRef, firestoreData);
    } else {
      // Create new pipeline
      await setDoc(pipelineRef, firestoreData);
    }
    
    return pipelineData;
  } catch (error: any) {
    console.error('Error saving pipeline:', error);
    throw error;
  }
};

// Get all pipelines for the current user
export const listPipelines = async (): Promise<Pipeline[]> => {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const pipelinesQuery = query(
      collection(db, pipelinesCollection),
      where('userId', '==', user.uid),
      where('deleted', '==', false)
    );
    
    const querySnapshot = await getDocs(pipelinesQuery);
    const pipelines: Pipeline[] = [];
    
    querySnapshot.forEach((doc) => {
      pipelines.push(doc.data() as Pipeline);
    });
    
    return pipelines;
  } catch (error: any) {
    console.error('Error listing pipelines:', error);
    throw error;
  }
};

// Get a single pipeline
export const loadPipeline = async (pipelineId: string): Promise<Pipeline> => {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const pipelineRef = doc(db, pipelinesCollection, pipelineId);
    const pipelineSnapshot = await getDoc(pipelineRef);
    
    if (!pipelineSnapshot.exists()) {
      throw new Error('Pipeline not found');
    }
    
    const pipeline = pipelineSnapshot.data() as Pipeline;
    
    // Verify ownership
    if (pipeline.userId !== user.uid) {
      throw new Error('Not authorized to access this pipeline');
    }
    
    return pipeline;
  } catch (error: any) {
    console.error('Error loading pipeline:', error);
    throw error;
  }
};

// Delete a pipeline (soft delete)
export const deletePipeline = async (pipelineId: string): Promise<void> => {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  try {
    const pipelineRef = doc(db, pipelinesCollection, pipelineId);
    const pipelineSnapshot = await getDoc(pipelineRef);
    
    if (!pipelineSnapshot.exists()) {
      throw new Error('Pipeline not found');
    }
    
    const pipeline = pipelineSnapshot.data() as Pipeline;
    
    // Verify ownership
    if (pipeline.userId !== user.uid) {
      throw new Error('Not authorized to delete this pipeline');
    }
    
    // Soft delete
    const updateData: DocumentData = {
      deleted: true,
      updatedAt: serverTimestamp()
    };
    await updateDoc(pipelineRef, updateData);
  } catch (error: any) {
    console.error('Error deleting pipeline:', error);
    throw error;
  }
};
