import { useState } from 'react';
import { 
  PipelineGenerationResponse, 
  PipelineGenerationRequest,
  PipelineGenerationResponseSchema,
  ChatMessage 
} from '@/types/pipeline';
import { useToast } from '@/hooks/useToast';

interface PipelineGeneratorResult {
  pipelineJson: PipelineGenerationResponse['pipelineJson'];
  reasoning?: string;
}

export function usePipelineGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const { toast } = useToast();
  
  /**
   * Generates a pipeline configuration based on a natural language description
   * Uses the /api/generatePipeline endpoint with Azure OpenAI
   * 
   * @param prompt Natural language description of the desired pipeline
   * @returns Generated pipeline configuration
   */
  const generatePipeline = async (prompt: string): Promise<PipelineGeneratorResult> => {
    setIsLoading(true);
    setError(null);
    
    // Add user message to chat history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    
    try {
      // Call the API route
      const response = await fetch('/api/generatePipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt } as PipelineGenerationRequest)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate the response using Zod
      const validatedResponse = PipelineGenerationResponseSchema.parse(data);
      
      // Add assistant message to chat history
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: validatedResponse.reasoning || 'Pipeline generated successfully!',
        timestamp: new Date(),
        metadata: {
          pipelineGenerated: true
        }
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      
      toast({
        title: 'Pipeline Generated',
        description: `Created ${validatedResponse.pipelineJson.nodes.length} nodes and ${validatedResponse.pipelineJson.edges.length} connections`,
        variant: 'default'
      });
      
      return {
        pipelineJson: validatedResponse.pipelineJson,
        reasoning: validatedResponse.reasoning
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error in pipeline generation');
      setError(error);
      
      // Add error message to chat history
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Pipeline generation failed: ${error.message}`,
        timestamp: new Date()
      };
      
      setChatHistory(prev => [...prev, errorMessage]);
      
      toast({
        title: 'Pipeline Generation Failed',
        description: error.message,
        variant: 'destructive'
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Clears the chat history
   */
  const clearChatHistory = () => {
    setChatHistory([]);
  };
  
  /**
   * Adds a message to chat history (for manual additions)
   */
  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const fullMessage: ChatMessage = {
      ...message,
      id: `${message.role}-${Date.now()}`,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, fullMessage]);
  };
  
  return {
    generatePipeline,
    isLoading,
    error,
    chatHistory,
    clearChatHistory,
    addMessage
  };
}
