'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiLoader, FiMessageSquare, FiDownload, FiExternalLink } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MCPChatInterfaceProps {
  pipelineId: string;
  pipelineName: string;
  onDeploy?: () => void;
  onExport?: () => void;
}

export default function MCPChatInterface({ 
  pipelineId, 
  pipelineName, 
  onDeploy, 
  onExport 
}: MCPChatInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! Your MCP pipeline "${pipelineName}" is ready. I can now answer questions based on your uploaded content and configured tools. What would you like to know?`,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          pipelineId,
          chatId,
          context: `This is a chat with an MCP server based on pipeline: ${pipelineName}`
        })
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.chatId && !chatId) {
        setChatId(data.chatId);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I was unable to generate a response.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Chat Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive'
      });

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDeploy = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/deployMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pipelineId
        })
      });

      if (!response.ok) {
        throw new Error(`Deployment failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      toast({
        title: 'Deployment Started',
        description: 'Your MCP server is being deployed to Heroku. This may take a few minutes.',
        variant: 'success'
      });

      if (onDeploy) {
        onDeploy();
      }

      // Add deployment status message
      const deployMessage: Message = {
        id: `deploy-${Date.now()}`,
        role: 'assistant',
        content: `🚀 Great! I'm now deploying your MCP server to Heroku. You'll receive a notification when it's live at: ${data.appUrl || 'your-app-url.herokuapp.com'}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, deployMessage]);

    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: 'Deployment Error',
        description: error instanceof Error ? error.message : 'Failed to deploy MCP server',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/exportMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pipelineId
        })
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.downloadUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `${pipelineName}-mcp-server.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Export Complete',
          description: 'Your MCP server code has been downloaded as a ZIP file.',
          variant: 'success'
        });

        if (onExport) {
          onExport();
        }
      }

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Error',
        description: error instanceof Error ? error.message : 'Failed to export MCP server',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
            <FiMessageSquare className="mr-2" />
            {pipelineName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chat with your MCP server
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 flex items-center"
          >
            <FiDownload className="mr-1 h-4 w-4" />
            Export
          </button>
          
          <button
            onClick={handleDeploy}
            disabled={isLoading}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400 flex items-center"
          >
            <FiExternalLink className="mr-1 h-4 w-4" />
            Deploy
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg">
              <FiLoader className="animate-spin h-4 w-4 text-gray-500" />
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your content..."
            className="flex-1 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md shadow-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            <FiSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
