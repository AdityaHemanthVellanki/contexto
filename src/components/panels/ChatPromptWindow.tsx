'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BiSend } from 'react-icons/bi';
import { FiCpu, FiLoader } from 'react-icons/fi';
import { useChatStore, ChatMessage } from '@/store/useChatStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { modelMapping } from '@/lib/azureOpenAI';
// Import firebase services
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from '@/lib/firebase';

export default function ChatPromptWindow() {
  const [prompt, setPrompt] = useState('');
  const [textareaHeight, setTextareaHeight] = useState(80);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const analytics = getAnalytics(app);

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
      // Get current user
      const auth = getAuth();
      const user = auth.currentUser;
      const userId = user?.uid || 'anonymous';
      
      // Store the prompt in Firestore
      const db = getFirestore();
      const promptsCollection = collection(db, 'prompts');
      
      await addDoc(promptsCollection, {
        userId,
        prompt,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      
      const handleGeneratePipeline = async (userMessage: string) => {
        try {
          setIsGenerating(true);
          
          // Clear existing canvas
          setNodes([]);
          setEdges([]);
          
          // Add user message
          addMessage('user', userMessage);
          
          // Get the current user from Firebase
          const user = auth.currentUser;
          if (!user) {
            console.error('User is not authenticated');
            addMessage('assistant', 'You need to be signed in to use this feature.');
            setIsGenerating(false);
            return;
          }
          
          // Send analytics event
          logEvent(analytics, 'generate_pipeline_request', {
            userId: user.uid,
            messageLength: userMessage.length,
          });
          
          const token = await user.getIdToken();
          
          // Call the real API to generate a pipeline
          const response = await fetch('/api/generatePipeline', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              prompt: userMessage,
              userId: user.uid
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
          }

          const pipelineData = await response.json();
          
          // Add assistant message with pipeline data
          addMessage('assistant', `I generated a pipeline based on your description. ${pipelineData.summary || 'You can see it in the canvas now.'}`);
          
          // Update the canvas with the generated nodes and edges
          setNodes(pipelineData.nodes);
          setEdges(pipelineData.edges);
        } catch (apiError: any) {
          console.error('Pipeline generation API error:', apiError);
          const errorMessage = apiError.message || 'Unknown error';
          addMessage('assistant', `Sorry, I encountered an error while generating the pipeline: ${errorMessage}. Please try again.`);
        } finally {
          setIsGenerating(false);
        }
      };

      await handleGeneratePipeline(prompt);
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
