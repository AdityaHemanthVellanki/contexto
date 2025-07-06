'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BiSend } from 'react-icons/bi';
import { FiCpu, FiLoader } from 'react-icons/fi';
import { useChatStore, ChatMessage } from '@/store/useChatStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { modelMapping } from '@/lib/azureOpenAI';
// Import firebase services if needed
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export default function ChatPromptWindow() {
  const [prompt, setPrompt] = useState('');
  const [textareaHeight, setTextareaHeight] = useState(80);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    messages, 
    addMessage, 
    isGenerating, 
    setIsGenerating
  } = useChatStore();
  
  const { setNodes, setEdges } = useCanvasStore();

  useEffect(() => {
    // Scroll to the most recent message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      const minHeight = 80;
      const maxHeight = 200;
      const scrollHeight = textareaRef.current.scrollHeight;
      setTextareaHeight(
        Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitPrompt();
    }
  };

  const handleSubmitPrompt = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    // Add user message to chat
    addMessage('user', prompt);
    setPrompt('');
    setTextareaHeight(80);
    
    // Start generating pipeline
    setIsGenerating(true);
    
    try {
      // In a real implementation, you would call the Azure OpenAI API here
      // For now, we'll simulate a response after a delay
      
      // Example of how this might be implemented with Azure OpenAI:
      /*
      const response = await openai.chat.completions.create({
        deploymentId: modelMapping.turbo,
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that converts natural language descriptions into JSON pipeline configurations for a data processing system.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      const pipelineData = JSON.parse(response.choices[0].message.content);
      */
      
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Example response (would come from API)
      const mockPipelineData = {
        nodes: [
          {
            id: 'dataSource-1',
            type: 'dataSource',
            position: { x: 100, y: 100 },
            data: {
              type: 'dataSource',
              label: 'PDF Files',
              settings: { sourceType: 'PDF' }
            }
          },
          {
            id: 'chunker-1',
            type: 'chunker',
            position: { x: 300, y: 100 },
            data: {
              type: 'chunker',
              label: 'Text Splitter',
              settings: { chunkSize: 1000 }
            }
          },
          {
            id: 'embedder-1',
            type: 'embedder',
            position: { x: 500, y: 100 },
            data: {
              type: 'embedder',
              label: 'Azure Embeddings',
              settings: { model: modelMapping.embed }
            }
          }
        ],
        edges: [
          { id: 'edge-1-2', source: 'dataSource-1', target: 'chunker-1' },
          { id: 'edge-2-3', source: 'chunker-1', target: 'embedder-1' }
        ],
        summary: "Created a simple pipeline that processes PDF files, chunks the content into 1000-token segments, and creates embeddings using Azure's embedding model."
      };
      
      // Add assistant message with pipeline data
      addMessage('assistant', 'I generated a pipeline based on your description. You can see it in the canvas now.');
      
      // Update the canvas with the generated nodes and edges
      setNodes(mockPipelineData.nodes);
      setEdges(mockPipelineData.edges);
      
    } catch (error) {
      console.error('Error generating pipeline:', error);
      
      // Add error message to chat
      addMessage('assistant', 'Sorry, I encountered an error while generating the pipeline. Please try again.');
      
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400"
            >
              <FiCpu className="w-12 h-12 mb-3" />
              <h3 className="text-lg font-medium">Describe Your MCP Server</h3>
              <p className="max-w-md mt-2 text-sm">
                Tell me what kind of Model Context Protocol (MCP) server you want to build,
                and I'll generate a pipeline for you.
              </p>
            </motion.div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 rounded-lg max-w-[85%] ${
                  message.role === 'user'
                    ? 'ml-auto bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div className="text-xs mt-1 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </div>
      
      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start space-x-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe your MCP server..."
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 resize-none"
            style={{ height: `${textareaHeight}px` }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmitPrompt}
            disabled={!prompt.trim() || isGenerating}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <FiLoader className="w-5 h-5 animate-spin" />
            ) : (
              <BiSend className="w-5 h-5" />
            )}
          </motion.button>
        </div>
        <div className="mt-3 flex">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmitPrompt}
            disabled={!prompt.trim() || isGenerating}
            className="mx-auto py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                <span>Generating Pipeline...</span>
              </>
            ) : (
              <>
                <FiCpu className="w-4 h-4" />
                <span>Generate Pipeline</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
