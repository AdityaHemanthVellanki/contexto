'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiUpload, FiFileText, FiCpu, FiDatabase, FiCheck, FiLoader } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

interface PipelineProgressProps {
  pipelineId: string;
  onComplete: () => void;
}

type PipelineStage = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface PipelineStatus {
  stage: PipelineStage;
  progress: number;
  error?: string;
  totalChunks?: number;
  processedChunks?: number;
}

export default function PipelineProgress({ pipelineId, onComplete }: PipelineProgressProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PipelineStatus>({
    stage: 'uploading',
    progress: 0
  });
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user || !pipelineId) return;

    const setupEventSource = async () => {
      try {
        const token = await user.getIdToken();
        
        // Close any existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        
        // Create a new EventSource connection with the token in the URL
        const url = `/api/processPipeline/status?pipelineId=${pipelineId}&token=${token}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;
        
        // Handle connection open
        eventSource.onopen = () => {
          console.log('Pipeline status connection established');
        };
        
        // Handle incoming messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if this is just a connection confirmation
            if (data.connected) {
              console.log('Pipeline status connection confirmed');
              return;
            }
            
            // Update status with the received data
            setStatus(data);
            
            // If the pipeline is complete or has an error, close the connection
            if (data.stage === 'complete' || data.error) {
              eventSource.close();
              if (data.stage === 'complete') {
                onComplete();
              }
              if (data.error) {
                setError(data.error);
              }
            }
          } catch (err) {
            console.error('Error parsing pipeline status:', err);
          }
        };
        
        // Handle errors
        eventSource.onerror = (err) => {
          console.error('Pipeline status connection error:', err);
          setError('Connection to pipeline status lost. Please refresh the page.');
          eventSource.close();
          
          // Implement polling fallback if needed
          // For now, just log the error
          console.log('Could implement polling fallback here');
        };
      } catch (err) {
        console.error('Failed to set up pipeline status connection:', err);
        setError('Failed to connect to pipeline status. Please refresh the page.');
      }
    };
    
    setupEventSource();
    
    // Clean up the connection when the component unmounts
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user, pipelineId, onComplete]);

  // Helper function to get the stage icon
  const getStageIcon = (stage: PipelineStage, currentStage: PipelineStage) => {
    const isActive = stage === currentStage;
    const isComplete = getStageIndex(currentStage) > getStageIndex(stage);
    
    if (isComplete) {
      return <FiCheck className="text-green-500" />;
    }
    
    switch (stage) {
      case 'uploading':
        return isActive ? <FiLoader className="animate-spin text-blue-500" /> : <FiUpload />;
      case 'extracting':
        return isActive ? <FiLoader className="animate-spin text-blue-500" /> : <FiFileText />;
      case 'chunking':
        return isActive ? <FiLoader className="animate-spin text-blue-500" /> : <FiFileText />;
      case 'embedding':
        return isActive ? <FiLoader className="animate-spin text-blue-500" /> : <FiCpu />;
      case 'indexing':
        return isActive ? <FiLoader className="animate-spin text-blue-500" /> : <FiDatabase />;
      case 'complete':
        return <FiCheck className="text-green-500" />;
    }
  };
  
  // Helper function to get stage index for comparison
  const getStageIndex = (stage: PipelineStage): number => {
    const stages: PipelineStage[] = ['uploading', 'extracting', 'chunking', 'embedding', 'indexing', 'complete'];
    return stages.indexOf(stage);
  };
  
  // Helper function to get stage label
  const getStageLabel = (stage: PipelineStage): string => {
    switch (stage) {
      case 'uploading': return 'Downloading Files';
      case 'extracting': return 'Extracting Text';
      case 'chunking': return 'Chunking Content';
      case 'embedding': return 'Generating Embeddings';
      case 'indexing': return 'Indexing Vectors';
      case 'complete': return 'Processing Complete';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Pipeline Processing</h2>
      
      {error ? (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : null}
      
      <div className="space-y-6">
        {/* Progress stages */}
        <div className="flex justify-between items-center">
          {['uploading', 'extracting', 'chunking', 'embedding', 'indexing', 'complete'].map((stage) => (
            <div key={stage} className="flex flex-col items-center">
              <motion.div 
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  stage === status.stage 
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500' 
                    : getStageIndex(stage as PipelineStage) < getStageIndex(status.stage)
                      ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500'
                      : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'
                }`}
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: stage === status.stage ? 1.1 : 1,
                  rotate: stage === status.stage ? [0, 5, -5, 0] : 0
                }}
                transition={{ 
                  duration: 0.5,
                  repeat: stage === status.stage ? Infinity : 0,
                  repeatType: "reverse"
                }}
              >
                {getStageIcon(stage as PipelineStage, status.stage)}
              </motion.div>
              <span className="text-xs mt-2 text-center">
                {getStageLabel(stage as PipelineStage)}
              </span>
            </div>
          ))}
        </div>
        
        {/* Current stage progress */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">
              {getStageLabel(status.stage)}
            </span>
            <span className="text-sm font-medium">
              {status.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <motion.div 
              className="bg-blue-600 h-2.5 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${status.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        
        {/* Chunk processing info */}
        {status.stage === 'chunking' && status.totalChunks && (
          <div className="text-sm text-center">
            Processing chunks: {status.processedChunks || 0} / {status.totalChunks}
          </div>
        )}
      </div>
    </div>
  );
}
