'use client';

import { useEffect } from 'react';
import TestPanel from '@/components/panels/TestPanel';
import { useCanvasStore } from '@/store/useCanvasStore';
import { AuthProvider } from '@/context/AuthContext';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default function TestPage() {
  const { setNodes, setEdges } = useCanvasStore();
  
  // Load user's existing pipelines or create empty canvas
  useEffect(() => {
    const loadUserPipelines = async () => {
      try {
        // Clear canvas initially
        setNodes([]);
        setEdges([]);
        
        // Check if user is authenticated
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (user) {
          // Try to load user's most recent pipeline from Firestore
          const db = getFirestore();
          const pipelinesRef = collection(db, 'users', user.uid, 'pipelines');
          const pipelineQuery = query(pipelinesRef, orderBy('updatedAt', 'desc'), limit(1));
          
          const snapshot = await getDocs(pipelineQuery);
          
          if (!snapshot.empty) {
            const pipelineData = snapshot.docs[0].data();
            if (pipelineData.nodes && pipelineData.edges) {
              setNodes(pipelineData.nodes);
              setEdges(pipelineData.edges);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error loading user pipeline:', error);
      }
    };
    
    loadUserPipelines();
  }, [setNodes, setEdges]);
  
  return (
    <AuthProvider>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Pipeline Testing</h1>
        <div className="grid grid-cols-1 gap-6">
          <div className="h-[600px]">
            <TestPanel />
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
