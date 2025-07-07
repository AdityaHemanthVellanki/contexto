import { auth, db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';

// Helper function to check authentication
const checkAuth = () => {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  return user;
};

// API Functions - Direct Firestore Implementation
export const api = {
  // List pipelines
  listPipelines: async () => {
    const user = checkAuth();
    
    try {
      const pipelinesCollection = collection(db, 'pipelines');
      const q = query(pipelinesCollection, where('userId', '==', user.uid), where('deleted', '==', false));
      const querySnapshot = await getDocs(q);
      
      const pipelines = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { data: pipelines };
    } catch (error: any) {
      console.error('Error listing pipelines:', error);
      throw new Error(`Error listing pipelines: ${error.message}`);
    }
  },
  
  // Get a pipeline
  getPipeline: async (id: string) => {
    const user = checkAuth();
    
    try {
      const pipelineRef = doc(db, 'pipelines', id);
      const pipelineSnap = await getDoc(pipelineRef);
      
      if (!pipelineSnap.exists()) {
        throw new Error('Pipeline not found');
      }
      
      const pipelineData = pipelineSnap.data();
      
      // Check if pipeline belongs to the current user
      if (pipelineData.userId !== user.uid) {
        throw new Error('Unauthorized access to pipeline');
      }
      
      // Check if pipeline is deleted
      if (pipelineData.deleted) {
        throw new Error('Pipeline has been deleted');
      }
      
      return { data: { id: pipelineSnap.id, ...pipelineData } };
    } catch (error: any) {
      console.error('Error getting pipeline:', error);
      throw new Error(`Error getting pipeline: ${error.message}`);
    }
  },
  
  // Save a pipeline
  savePipeline: async (pipeline: { id?: string; name: string; graph: any }) => {
    const user = checkAuth();
    
    try {
      const timestamp = Timestamp.now();
      const pipelineData: any = {
        name: pipeline.name,
        graph: pipeline.graph,
        userId: user.uid,
        updatedAt: timestamp,
        deleted: false
      };
      
      let pipelineId = pipeline.id;
      
      if (pipelineId) {
        // Update existing pipeline
        const pipelineRef = doc(db, 'pipelines', pipelineId);
        await updateDoc(pipelineRef, pipelineData);
      } else {
        // Create new pipeline
        pipelineData.createdAt = timestamp;
        const pipelinesCollection = collection(db, 'pipelines');
        const newDocRef = doc(pipelinesCollection);
        pipelineId = newDocRef.id;
        await setDoc(newDocRef, pipelineData);
      }
      
      return { data: { id: pipelineId, ...pipelineData } };
    } catch (error: any) {
      console.error('Error saving pipeline:', error);
      throw new Error(`Error saving pipeline: ${error.message}`);
    }
  },
  
  // Delete a pipeline (soft delete)
  deletePipeline: async (id: string) => {
    const user = checkAuth();
    
    try {
      const pipelineRef = doc(db, 'pipelines', id);
      const pipelineSnap = await getDoc(pipelineRef);
      
      if (!pipelineSnap.exists()) {
        throw new Error('Pipeline not found');
      }
      
      const pipelineData = pipelineSnap.data();
      
      // Check if pipeline belongs to the current user
      if (pipelineData.userId !== user.uid) {
        throw new Error('Unauthorized access to pipeline');
      }
      
      // Soft delete by marking as deleted
      await updateDoc(pipelineRef, { 
        deleted: true,
        updatedAt: Timestamp.now()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting pipeline:', error);
      throw new Error(`Error deleting pipeline: ${error.message}`);
    }
  },
  
  // Run a pipeline - Real implementation with Firebase Functions
  runPipeline: async (id: string, prompt: string) => {
    const user = checkAuth();
    
    try {
      // Get the auth token for the API call
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/pipelines/${id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run pipeline');
      }
      
      return { data: await response.json() };
    } catch (error: any) {
      console.error('Error running pipeline:', error);
      throw new Error(`Error running pipeline: ${error.message}`);
    }
  },
  
  // Log usage metrics
  logUsage: async (callType: string, promptTokens: number, completionTokens: number) => {
    const user = checkAuth();
    
    try {
      // Get the auth token for the API call
      const token = await user.getIdToken();
      
      const response = await fetch('/api/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          callType,
          promptTokens,
          completionTokens
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error logging usage:', errorData.error);
        return { success: false, error: errorData.error };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error logging usage:', error);
      // Don't throw an error for usage logging failures
      return { success: false, error: error.message };
    }
  }
};
