'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Graph } from '@/services/executePipeline';
import { api } from '@/utils/api';
import { BiPlay, BiLoader, BiRefresh } from 'react-icons/bi';

export default function TestPanel() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [usageReport, setUsageReport] = useState<Record<string, any> | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { nodes, edges } = useCanvasStore();
  
  // Convert canvas nodes and edges to the format expected by executePipeline
  const getGraphData = (): Graph => {
    return {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as 'dataSource' | 'chunker' | 'embedder' | 'indexer' | 'retriever' | 'output',
        position: { x: node.position.x, y: node.position.y },
        data: {
          type: node.data.type,
          label: node.data.label,
          settings: node.data.settings || {}
        }
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target
      }))
    };
  };
  
  // Run test with the current pipeline and prompt
  const handleRunTest = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }
    
    if (nodes.length === 0) {
      alert('Please create a pipeline first');
      return;
    }
    
    if (!user) {
      alert('You must be signed in to run pipelines');
      return;
    }
    
    setLoading(true);
    setLogs(['Starting pipeline execution...']);
    setResult(null);
    setUsageReport(null);
    
    try {
      // If we don't have a saved pipeline yet, create one
      let currentPipelineId = pipelineId;
      
      if (!currentPipelineId) {
        setLogs(prev => [...prev, 'Creating temporary pipeline...']);
        const savedPipeline = await api.savePipeline({
          name: 'Temporary Test Pipeline',
          graph: getGraphData()
        });
        
        currentPipelineId = savedPipeline.data.id;
        setPipelineId(currentPipelineId);
        setLogs(prev => [...prev, 'Temporary pipeline created']);
      }
      
      // Call the API to run the pipeline
      setLogs(prev => [...prev, 'Executing pipeline...']);
      const pipelineResult = await api.runPipeline(currentPipelineId!, prompt);
      
      if (!pipelineResult.data) {
        throw new Error('Failed to run pipeline - no data returned');
      }
      
      // Update logs with execution results
      setLogs(prev => [
        ...prev, 
        'Pipeline executed successfully',
        'Result:',
      ]);
      
      setResult(pipelineResult.data.result);
      setUsageReport(pipelineResult.data.usage);
      
    } catch (error) {
      console.error('Error running pipeline:', error);
      setLogs(prev => [
        ...prev,
        `Error: ${error instanceof Error ? error.message : String(error)}`
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  // Refine the current result
  const handleRefineAnswer = async () => {
    if (!result) {
      alert('No result to refine');
      return;
    }
    
    if (!user) {
      alert('You must be signed in to refine answers');
      return;
    }
    
    setRefining(true);
    
    try {
      // Get the user's auth token
      const token = await user.getIdToken();
      
      // Call the refineAnswer API
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: result,
          instructions: 'Make this more concise and clear.'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refine answer');
      }
      
      const data = await response.json();
      
      setLogs(prev => [
        ...prev,
        'Result refined successfully',
        'Refined Result:',
      ]);
      
      setResult(data.text);
      
      // Update usage report if provided
      if (data.usage) {
        setUsageReport(prev => ({
          ...prev,
          refine: data.usage
        }));
      }
      
    } catch (error) {
      console.error('Error refining answer:', error);
      setLogs(prev => [
        ...prev,
        `Refinement Error: ${error instanceof Error ? error.message : String(error)}`
      ]);
    } finally {
      setRefining(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Test Pipeline</h2>
      
      {/* Prompt input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          disabled={loading || refining}
        />
      </div>
      
      {/* Action buttons */}
      <div className="flex space-x-4 mb-4">
        <button
          className={`flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleRunTest}
          disabled={loading || refining}
        >
          {loading ? (
            <>
              <BiLoader className="animate-spin mr-2" />
              Running...
            </>
          ) : (
            <>
              <BiPlay className="mr-2" />
              Run Test
            </>
          )}
        </button>
        
        {result && (
          <button
            className={`flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 ${
              refining ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleRefineAnswer}
            disabled={loading || refining || !result}
          >
            {refining ? (
              <>
                <BiLoader className="animate-spin mr-2" />
                Refining...
              </>
            ) : (
              <>
                <BiRefresh className="mr-2" />
                Refine Answer
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Logs and results */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Execution logs */}
        {logs.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <h3 className="text-md font-semibold mb-2">Execution Logs</h3>
            <div className="bg-gray-100 p-2 rounded-md max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-sm mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Results */}
        {result && (
          <div className="mb-4 flex-grow overflow-hidden flex flex-col">
            <h3 className="text-md font-semibold mb-2">Result</h3>
            <div className="bg-gray-100 p-3 rounded-md overflow-y-auto flex-grow">
              <pre className="whitespace-pre-wrap text-sm">{result}</pre>
            </div>
          </div>
        )}
        
        {/* Usage report */}
        {usageReport && (
          <div className="mt-auto">
            <h3 className="text-md font-semibold mb-2">Usage Report</h3>
            <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto">
              <pre className="text-xs">{JSON.stringify(usageReport, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
