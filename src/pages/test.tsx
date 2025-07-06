import { useEffect } from 'react';
import TestPanel from '@/components/panels/TestPanel';
import { useCanvasStore } from '@/store/useCanvasStore';

export default function TestPage() {
  const { setNodes, setEdges } = useCanvasStore();
  
  // Create a sample pipeline for testing on initial load
  useEffect(() => {
    const samplePipeline = {
      nodes: [
        {
          id: 'ds-1',
          type: 'dataSource',
          position: { x: 100, y: 100 },
          data: {
            type: 'dataSource',
            label: 'User Input',
            settings: { sourceType: 'text', content: '' }
          }
        },
        {
          id: 'ch-1',
          type: 'chunker',
          position: { x: 100, y: 250 },
          data: {
            type: 'chunker',
            label: 'Text Splitter',
            settings: { chunkSize: 1000, chunkOverlap: 200, splitBy: 'token' }
          }
        },
        {
          id: 'em-1',
          type: 'embedder',
          position: { x: 100, y: 400 },
          data: {
            type: 'embedder',
            label: 'Azure Embeddings',
            settings: { model: 'azure-embedding', dimensions: 1536 }
          }
        },
        {
          id: 'op-1',
          type: 'output',
          position: { x: 400, y: 400 },
          data: {
            type: 'output',
            label: 'Results',
            settings: { outputFormat: 'rag' }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'ds-1', target: 'ch-1' },
        { id: 'e2-3', source: 'ch-1', target: 'em-1' },
        { id: 'e3-4', source: 'em-1', target: 'op-1' }
      ]
    };
    
    // Set the sample pipeline in the canvas store
    setNodes(samplePipeline.nodes);
    setEdges(samplePipeline.edges);
  }, [setNodes, setEdges]);
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pipeline Testing</h1>
      <div className="grid grid-cols-1 gap-6">
        <div className="h-[600px]">
          <TestPanel />
        </div>
      </div>
    </div>
  );
}
