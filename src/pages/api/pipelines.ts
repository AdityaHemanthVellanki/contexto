import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { verifyIdToken } from '@/lib/auth';
import { Graph } from '@/services/executePipeline';

/**
 * API handler for pipeline CRUD operations
 * Supports GET, POST, PUT, DELETE for managing pipelines
 * 
 * All operations are secured and multi-tenant (user-specific)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify the Firebase ID token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - Missing or invalid token' });
  }

  let userId: string;
  try {
    // Extract and verify the token
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    userId = decodedToken.uid;
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  // Process based on HTTP method
  try {
    switch (req.method) {
      case 'GET': {
        // Get a specific pipeline or list all user's pipelines
        const { id } = req.query;
        
        if (id && typeof id === 'string') {
          // Get a specific pipeline
          const pipelineRef = doc(db, 'pipelines', id);
          const pipelineDoc = await getDoc(pipelineRef);
          
          if (!pipelineDoc.exists()) {
            return res.status(404).json({ error: 'Pipeline not found' });
          }
          
          // Check ownership
          const data = pipelineDoc.data();
          if (data.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden - You do not have access to this pipeline' });
          }
          
          return res.status(200).json({ id: pipelineDoc.id, ...data });
        } else {
          // List all pipelines for the user
          const q = query(collection(db, 'pipelines'), where('userId', '==', userId));
          const querySnapshot = await getDocs(q);
          
          const pipelines = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          return res.status(200).json(pipelines);
        }
      }
      
      case 'POST': {
        // Create a new pipeline
        const { name, description, graph } = req.body;
        
        if (!name || !graph) {
          return res.status(400).json({ error: 'Name and graph are required' });
        }
        
        // Validate graph structure
        const graphObj = graph as Graph;
        if (!graphObj?.nodes || !graphObj?.edges || !Array.isArray(graphObj.nodes) || !Array.isArray(graphObj.edges)) {
          return res.status(400).json({ error: 'Invalid graph structure' });
        }
        
        // Add the pipeline
        const docRef = await addDoc(collection(db, 'pipelines'), {
          name,
          description: description || '',
          graph,
          userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        return res.status(201).json({ id: docRef.id, name, description, graph });
      }
      
      case 'PUT': {
        // Update an existing pipeline
        const { id, name, description, graph } = req.body;
        
        if (!id || !name || !graph) {
          return res.status(400).json({ error: 'ID, name, and graph are required' });
        }
        
        // Verify the pipeline exists and belongs to the user
        const pipelineRef = doc(db, 'pipelines', id);
        const pipelineDoc = await getDoc(pipelineRef);
        
        if (!pipelineDoc.exists()) {
          return res.status(404).json({ error: 'Pipeline not found' });
        }
        
        // Check ownership
        const data = pipelineDoc.data();
        if (data.userId !== userId) {
          return res.status(403).json({ error: 'Forbidden - You do not have access to this pipeline' });
        }
        
        // Update the pipeline
        await updateDoc(pipelineRef, {
          name,
          description: description || '',
          graph,
          updatedAt: serverTimestamp()
        });
        
        return res.status(200).json({ id, name, description, graph });
      }
      
      case 'DELETE': {
        // Delete a pipeline
        const { id } = req.query;
        
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Pipeline ID is required' });
        }
        
        // Verify the pipeline exists and belongs to the user
        const pipelineRef = doc(db, 'pipelines', id);
        const pipelineDoc = await getDoc(pipelineRef);
        
        if (!pipelineDoc.exists()) {
          return res.status(404).json({ error: 'Pipeline not found' });
        }
        
        // Check ownership
        const data = pipelineDoc.data();
        if (data.userId !== userId) {
          return res.status(403).json({ error: 'Forbidden - You do not have access to this pipeline' });
        }
        
        // Delete the pipeline
        await deleteDoc(pipelineRef);
        
        return res.status(200).json({ message: 'Pipeline deleted successfully' });
      }
      
      default:
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Pipeline API error:', error);
    return res.status(500).json({ error: 'Server Error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}
