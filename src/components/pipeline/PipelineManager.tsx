'use client';

import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAuth } from '@/context/AuthContext';
import { savePipeline, listPipelines, loadPipeline, deletePipeline, Pipeline } from '@/utils/pipelineService';
import { FiSave, FiFolder, FiTrash2, FiPlus } from 'react-icons/fi';

const PipelineManager: React.FC = () => {
  const { user } = useAuth();
  const { nodes, edges, canvasSettings, setNodes, setEdges, updateCanvasSettings } = useCanvasStore();
  
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPipelineList, setShowPipelineList] = useState<boolean>(false);
  
  // Load user's pipelines
  useEffect(() => {
    if (user) {
      fetchPipelines();
    }
  }, [user]);
  
  const fetchPipelines = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const userPipelines = await listPipelines();
      setPipelines(userPipelines);
    } catch (err: any) {
      setError('Failed to load pipelines: ' + err.message);
      console.error('Error fetching pipelines:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSavePipeline = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await savePipeline(
        canvasSettings.pipelineName,
        nodes,
        edges
      );
      
      // Refresh pipeline list
      await fetchPipelines();
      
      // Show success message
      alert('Pipeline saved successfully!');
    } catch (err: any) {
      setError('Failed to save pipeline: ' + err.message);
      console.error('Error saving pipeline:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLoadPipeline = async (pipelineId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const pipeline = await loadPipeline(pipelineId);
      
      // Update canvas with loaded pipeline
      setNodes(pipeline.graph.nodes);
      setEdges(pipeline.graph.edges);
      updateCanvasSettings({ pipelineName: pipeline.name });
      
      // Hide pipeline list
      setShowPipelineList(false);
    } catch (err: any) {
      setError('Failed to load pipeline: ' + err.message);
      console.error('Error loading pipeline:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeletePipeline = async (pipelineId: string) => {
    if (!user) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this pipeline?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await deletePipeline(pipelineId);
      
      // Refresh pipeline list
      await fetchPipelines();
    } catch (err: any) {
      setError('Failed to delete pipeline: ' + err.message);
      console.error('Error deleting pipeline:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNewPipeline = () => {
    // Confirm if user wants to start a new pipeline
    if (nodes.length > 0 && !window.confirm('Start a new pipeline? Unsaved changes will be lost.')) {
      return;
    }
    
    // Reset canvas
    setNodes([]);
    setEdges([]);
    updateCanvasSettings({ pipelineName: 'New Pipeline' });
    setShowPipelineList(false);
  };
  
  const togglePipelineList = () => {
    setShowPipelineList(!showPipelineList);
    
    // Refresh the list when opening
    if (!showPipelineList) {
      fetchPipelines();
    }
  };
  
  return (
    <div className="pipeline-manager p-2">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-4">
          {error}
        </div>
      )}
      
      <div className="flex space-x-2 mb-4">
        <button
          onClick={handleNewPipeline}
          className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow transition-colors"
          disabled={loading}
        >
          <FiPlus className="mr-2" />
          New
        </button>
        
        <button
          onClick={handleSavePipeline}
          className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-colors"
          disabled={loading}
        >
          <FiSave className="mr-2" />
          Save
        </button>
        
        <button
          onClick={togglePipelineList}
          className="flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md shadow transition-colors"
          disabled={loading}
        >
          <FiFolder className="mr-2" />
          Load
        </button>
      </div>
      
      {/* Pipeline name input */}
      <div className="mb-4">
        <input
          type="text"
          value={canvasSettings.pipelineName}
          onChange={(e) => updateCanvasSettings({ pipelineName: e.target.value })}
          placeholder="Pipeline Name"
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Pipeline list dropdown */}
      {showPipelineList && (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-4 max-h-80 overflow-y-auto">
          <h3 className="text-lg font-medium mb-4">Your Pipelines</h3>
          
          {loading && <div className="text-center p-4">Loading...</div>}
          
          {!loading && pipelines.length === 0 && (
            <div className="text-center p-4 text-gray-500">No pipelines found</div>
          )}
          
          {!loading && pipelines.length > 0 && (
            <ul className="space-y-2">
              {pipelines.map((pipeline) => (
                <li
                  key={pipeline.id}
                  className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <button
                    onClick={() => handleLoadPipeline(pipeline.id)}
                    className="flex-grow text-left font-medium"
                  >
                    {pipeline.name}
                  </button>
                  
                  <button
                    onClick={() => handleDeletePipeline(pipeline.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <FiTrash2 />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default PipelineManager;
