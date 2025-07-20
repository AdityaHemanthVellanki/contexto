'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  FiMessageSquare, 
  FiSend, 
  FiLoader, 
  FiAlertCircle,
  FiCheckCircle
} from 'react-icons/fi';
import { usePipelineGenerator } from '@/hooks/usePipelineGenerator';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useToast } from '@/components/ui/use-toast';

// Example prompts to help users get started
const examplePrompts = [
  "Create a pipeline that summarizes documents using embeddings",
  "Build a QA system for my technical documentation",
  "Make a pipeline that extracts key information from research papers",
  "Generate a classification pipeline for customer support tickets"
];

export default function ChatPromptTab() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const { generatePipeline } = usePipelineGenerator();
  const { setNodes, setEdges } = useCanvasStore();
  const { toast } = useToast();
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, content: prompt };
    setChatHistory(prev => [...prev, userMessage]);
    
    // Clear input
    setPrompt('');
    setIsGenerating(true);
    
    try {
      // Generate pipeline based on natural language description
      const result = await generatePipeline(prompt);
      
      // Add assistant message with response
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Created pipeline with ${result.pipelineJson.nodes.length} nodes and ${result.pipelineJson.edges.length} connections. You can now configure the nodes on the canvas.`
      }]);
      
      // Transform the pipeline nodes to match the React Flow node format
      const transformedNodes = result.pipelineJson.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          type: node.type, // Ensure type is in the data object as required by NodeData
        }
      }));
      
      // Update the canvas with transformed nodes and edges
      setNodes(transformedNodes);
      setEdges(result.pipelineJson.edges);
      
      toast({
        title: "Pipeline Generated",
        description: "Your pipeline has been created on the canvas",
        variant: "default",
      });
    } catch (error) {
      console.error('Error generating pipeline:', error);
      
      // Add error message to chat
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn't generate a pipeline from that description. ${
          error instanceof Error ? error.message : 'Please try again with a different description.'
        }`
      }]);
      
      toast({
        title: "Generation Failed",
        description: "Could not generate pipeline from description",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Apply an example prompt
  const applyExamplePrompt = (example: string) => {
    setPrompt(example);
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Chat history */}
      <div className="flex-grow overflow-y-auto mb-4 pr-2">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FiMessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Pipeline Generator</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Describe what kind of pipeline you want to build, and I'll generate it for you.
            </p>
            
            <div className="grid grid-cols-1 gap-3 w-full max-w-md">
              {examplePrompts.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start text-left px-4 py-6 h-auto whitespace-normal"
                  onClick={() => applyExamplePrompt(example)}
                >
                  <span className="line-clamp-2">{example}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {chatHistory.map((message, index) => (
              <Card
                key={index}
                className={`p-4 ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-8' 
                    : 'bg-muted mr-8'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="rounded-full p-2 bg-background/20 flex-shrink-0 mt-1">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="mt-auto">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <Textarea
            placeholder="Describe the pipeline you want to build..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] mb-2 resize-none"
            disabled={isGenerating}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Be specific about the data sources and outputs you need.
            </p>
            <Button 
              type="submit" 
              className="ml-auto" 
              disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FiSend className="mr-2 h-4 w-4" />
                  Generate Pipeline
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
