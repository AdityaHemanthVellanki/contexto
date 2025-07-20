'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiDownload, FiLoader } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { ConversationSession, ConversationMessage } from '@/types/conversation';
import { cn } from '@/utils/cn';

interface ChatWindowProps {
  className?: string;
}

export default function ChatWindow({ className }: ChatWindowProps) {
  const { user } = useAuth();
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize conversation session
  useEffect(() => {
    if (!user) return;

    const initializeSession = async () => {
      try {
        const token = await user.getIdToken();
        
        // Try to get existing active session
        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'get_active_session' })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get active session');
        }
        
        const data = await response.json();
        let activeSession = data.session;
        
        if (!activeSession) {
          // Create new session
          const createResponse = await fetch('/api/conversation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'create_session' })
          });
          
          if (!createResponse.ok) {
            throw new Error('Failed to create session');
          }
          
          const createData = await createResponse.json();
          activeSession = createData.session;
          
          // Add welcome message
          const welcomeMessage: ConversationMessage = {
            id: 'welcome',
            role: 'assistant',
            content: "Hi! Let's build your MCP pipeline step by step. First, what type of data source do you want to ingest? (CSV, PDF, S3, URL, or plain text)",
            timestamp: new Date(),
            metadata: { step: 'welcome' }
          };
          
          activeSession.messages = [welcomeMessage];
        }
        
        setSession(activeSession);
        setMessages(activeSession.messages);
        setCanExport(activeSession.status === 'completed');
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    };

    initializeSession();
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !session || isLoading) return;

    const userMessage: ConversationMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const token = await user?.getIdToken();
      
      // Process user input via API
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'process_input',
          sessionId: session.id,
          userInput: userMessage.content
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to process input');
      }
      
      const data = await response.json();
      
      // Create assistant response
      const assistantMessage: ConversationMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.error ? 
          `${data.error}\n\n${data.nextQuestion}` : 
          data.nextQuestion,
        timestamp: new Date(),
        metadata: { 
          isValid: !data.error,
          error: data.error 
        }
      };

      // Add assistant message
      setMessages(prev => [...prev, assistantMessage]);

      // Update export availability
      if (data.isComplete) {
        setCanExport(true);
      }

      // If we're at synthesis step, generate the pipeline
      if (data.nextQuestion.includes('Here\'s your MCP pipeline') && !data.error) {
        await generatePipeline();
      }

    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: ConversationMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I encountered an error. Could you please try again?",
        timestamp: new Date(),
        metadata: { error: 'Processing failed' }
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePipeline = async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/generatePipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({
          description: `Generate MCP pipeline with config: ${JSON.stringify(session.collectedData)}`,
          config: session.collectedData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate pipeline');
      }

      const data = await response.json();
      
      // Update session with generated pipeline
      setSession(prev => prev ? { ...prev, generatedPipeline: data.pipeline } : null);
      
    } catch (error) {
      console.error('Error generating pipeline:', error);
    }
  };

  const handleExport = async () => {
    if (!session?.generatedPipeline) return;

    try {
      const response = await fetch('/api/exportPipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({
          pipeline: session.generatedPipeline,
          name: `MCP_Pipeline_${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export pipeline');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mcp-pipeline-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Add success message
      const successMessage: ConversationMessage = {
        id: `export_${Date.now()}`,
        role: 'assistant',
        content: "🎉 Your MCP server ZIP has been downloaded successfully! You can now deploy it to your preferred hosting platform.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('Error exporting pipeline:', error);
      
      const errorMessage: ConversationMessage = {
        id: `export_error_${Date.now()}`,
        role: 'assistant',
        content: "Sorry, there was an error exporting your pipeline. Please try again.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
          <p className="text-gray-600">You need to be authenticated to build MCP pipelines.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-screen bg-gray-50 dark:bg-gray-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">MCP Pipeline Builder</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {session?.currentStep ? `Step: ${session.currentStep.replace('_', ' ')}` : 'Initializing...'}
          </p>
        </div>
        
        <button
          onClick={handleExport}
          disabled={!canExport}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all",
            canExport
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          )}
          aria-label="Export MCP Pipeline"
        >
          <FiDownload className="w-4 h-4" />
          <span>Export MCP</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-lg",
                  message.role === 'user'
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.metadata?.error && (
                  <div className="mt-2 text-sm text-red-400">
                    ⚠️ {message.metadata.error}
                  </div>
                )}
                <div className="mt-1 text-xs opacity-70">
                  {typeof message.timestamp === 'string' 
                    ? new Date(message.timestamp).toLocaleTimeString() 
                    : message.timestamp instanceof Date 
                      ? message.timestamp.toLocaleTimeString()
                      : new Date().toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <FiLoader className="w-4 h-4 animate-spin" />
                <span className="text-gray-600 dark:text-gray-400">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            rows={1}
            disabled={isLoading}
            aria-label="Message input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              "p-3 rounded-lg transition-all",
              inputValue.trim() && !isLoading
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            <FiSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
