'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiUpload, FiFileText, FiCpu, FiDatabase, FiCheck, FiLoader } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

interface PipelineProgressProps {
  pipelineId: string;
  onComplete: () => void;
}

type PipelineStage = 'downloading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface PipelineStatus {
  stage: PipelineStage;
  progressPercent: number;
  progress?: {
    downloading: boolean;
    extracting: boolean;
    chunking: boolean;
    embedding: boolean;
    indexing: boolean;
    completed: boolean;
  };
  error?: string;
  totalChunks?: number;
  processedChunks?: number;
  chunksCount?: number;
  vectorsCount?: number;
}

export default function PipelineProgress({ pipelineId, onComplete }: PipelineProgressProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PipelineStatus>({
    stage: 'downloading',
    progressPercent: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch pipeline status via polling
  const fetchPipelineStatus = async () => {
    if (!user || !pipelineId) return;
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/processPipeline/status/poll?pipelineId=${pipelineId}&token=${token}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pipeline status: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update status with the received data
      setStatus({
        stage: data.stage || 'downloading',
        progressPercent: data.progressPercent || data.progress || 0,
        progress: data.progress,
        error: data.error,
        totalChunks: data.totalChunks,
        processedChunks: data.processedChunks,
        chunksCount: data.chunksCount,
        vectorsCount: data.vectorsCount
      });
      
      // If the pipeline is complete or has an error, stop polling
      if (data.stage === 'complete' || data.error) {
        stopPolling();
        if (data.stage === 'complete') {
          onComplete();
        }
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error('Error polling pipeline status:', err);
      setError('Failed to fetch pipeline status. Please refresh the page.');
      stopPolling();
    }
  };
  
  // Start polling for pipeline status
  const startPolling = () => {
    if (isPolling) return;
    
    setIsPolling(true);
    console.log('Starting polling fallback for pipeline status');
    
    // Immediately fetch status once
    fetchPipelineStatus();
    
    // Then set up interval for continued polling
    pollingIntervalRef.current = setInterval(fetchPipelineStatus, 3000);
  };
  
  // Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

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
            setStatus({
              stage: data.stage || 'downloading',
              progressPercent: data.progressPercent || data.progress || 0,
              progress: data.progress,
              error: data.error,
              totalChunks: data.totalChunks,
              processedChunks: data.processedChunks,
              chunksCount: data.chunksCount,
              vectorsCount: data.vectorsCount
            });
            
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
          eventSource.close();
          eventSourceRef.current = null;
          
          // Start polling as fallback
          startPolling();
        };
      } catch (err) {
        console.error('Failed to set up pipeline status connection:', err);
        // Start polling as fallback instead of just showing an error
        startPolling();
      }
    };
    
    setupEventSource();
    
    // Clean up the connection when the component unmounts
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Also clean up polling if active
      stopPolling();
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
      case 'downloading':
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
    const stages: PipelineStage[] = ['downloading', 'extracting', 'chunking', 'embedding', 'indexing', 'complete'];
    return stages.indexOf(stage);
  };
  
  // Helper function to get stage label
  const getStageLabel = (stage: PipelineStage): string => {
    switch (stage) {
      case 'downloading': return 'Downloading Files';
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
      
      {isPolling && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-700 dark:text-yellow-200 px-4 py-2 rounded mb-4 text-sm flex items-center">
          <FiLoader className="animate-spin mr-2" />
          <span>Using polling fallback. Real-time updates may be delayed.</span>
        </div>
      )}
      
      {error ? (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : null}
      
      <div className="space-y-6">
        {/* Progress stages */}
        <div className="flex justify-between items-center">
          {['downloading', 'extracting', 'chunking', 'embedding', 'indexing', 'complete'].map((stage) => (
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
              {Math.round(status.progressPercent)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <motion.div 
              className="bg-blue-600 h-2.5 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.round(status.progressPercent)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        
        {/* Processing info */}
        {status.chunksCount && (
          <div className="text-sm text-center text-gray-600 dark:text-gray-400">
            {status.stage === 'chunking' && `Created ${status.chunksCount} text chunks`}
            {status.stage === 'embedding' && `Processing ${status.chunksCount} chunks for embeddings`}
            {status.stage === 'indexing' && `Indexing ${status.chunksCount} vectors`}
            {status.stage === 'complete' && status.vectorsCount && `Successfully indexed ${status.vectorsCount} vectors`}
          </div>
        )}
      </div>
    </div>
  );
}
