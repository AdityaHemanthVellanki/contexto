'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiDownload, FiLoader, FiBarChart2, FiFile } from 'react-icons/fi';
import FileSelectionModal from '@/components/mcp/FileSelectionModal';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import { useToast } from '@/components/ui/toast';

// Define message type
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  usageReport?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
}

interface ChatInterfaceProps {
  onShowAdvancedView: () => void;
  importedData: boolean;
  onImportData: () => void;
  activeFileId?: string;
}

export default function ChatInterface({ 
  onShowAdvancedView, 
  importedData, 
  onImportData,
  activeFileId 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showUsage, setShowUsage] = useState<string | null>(null);
  const [isFileSelectionModalOpen, setIsFileSelectionModalOpen] = useState(false);
  const [mcpFileId, setMcpFileId] = useState<string | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Enter key press in text area
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // If no user is signed in, show a toast notification
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to use the chat functionality.',
        variant: 'destructive'
      });
      return;
    }
    
    // Add the user message to the chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Get the user's auth token
      const token = await user.getIdToken();
      
      // Prepare the request body
      const requestBody: any = {
        message: input.trim(),
      };
      
      // If we have an active file ID, include it in the request
      if (activeFileId) {
        requestBody.fileId = activeFileId;
      }
      
      // Send the request to the API
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error('Failed to get a response from the API');
      }
      
      const data = await response.json();
      
      // Add the assistant message to the chat
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.result,
        timestamp: new Date(),
        usageReport: data.usage
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
        variant: 'destructive'
      });
      
      // Add an error message from the assistant
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle exporting the conversation to MCP
  const handleExportToMCP = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to export conversations.',
        variant: 'destructive'
      });
      return;
    }
    
    if (messages.length === 0) {
      toast({
        title: 'No messages',
        description: 'There are no messages to export.',
        variant: 'destructive'
      });
      return;
    }
    
    // Open the file selection modal to choose where to export
    setIsFileSelectionModalOpen(true);
  };

  // Handle file selection for MCP export
  const handleFileSelected = async (fileId: string) => {
    setMcpFileId(fileId);
    setIsFileSelectionModalOpen(false);
    setExportStatus('loading');
    
    try {
      // Get the user's auth token
      const token = await user!.getIdToken();
      
      // Prepare the conversation data
      const conversationData = {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        fileId: fileId
      };
      
      // Send the request to the export MCP API
      const response = await fetch('/api/exportMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(conversationData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to export conversation to MCP');
      }
      
      const data = await response.json();
      
      setExportStatus('success');
      
      toast({
        title: 'Export successful',
        description: 'Your conversation has been exported to MCP.',
        variant: 'default'
      });
      
    } catch (error) {
      console.error('Error exporting to MCP:', error);
      
      setExportStatus('error');
      
      toast({
        title: 'Export failed',
        description: 'Failed to export your conversation to MCP.',
        variant: 'destructive'
      });
      
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-gray-500 text-center px-4"
            >
              <p className="text-lg font-medium mb-2">Ask a question about your content</p>
              <p className="text-sm">Use the chat to interact with your data and get insights.</p>
              
              {!importedData && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md flex items-center"
                  onClick={onImportData}
                >
                  <FiFile className="mr-2" />
                  Import Data
                </motion.button>
              )}
            </motion.div>
          )}
          
          {messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex flex-col p-3 rounded-lg max-w-[85%]",
                message.role === 'user'
                  ? "ml-auto bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-xs">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {message.usageReport && (
                <div className="mt-2 text-xs">
                  <button
                    onClick={() => setShowUsage(showUsage === message.id ? null : message.id)}
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    <FiBarChart2 className="mr-1" />
                    {showUsage === message.id ? 'Hide stats' : 'Show usage stats'}
                  </button>
                  
                  {showUsage === message.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 text-gray-500"
                    >
                      <p>Prompt tokens: {message.usageReport.promptTokens}</p>
                      <p>Completion tokens: {message.usageReport.completionTokens}</p>
                      <p>Total tokens: {message.usageReport.totalTokens}</p>
                      <p>Latency: {(message.usageReport.latencyMs / 1000).toFixed(2)}s</p>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          
          {/* Loading animation */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center p-3 rounded-lg bg-gray-100 text-gray-800 max-w-[85%]"
            >
              <div className="flex space-x-1">
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
                  className="w-2 h-2 rounded-full bg-gray-500"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                  className="w-2 h-2 rounded-full bg-gray-500"
                />
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                  className="w-2 h-2 rounded-full bg-gray-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Invisible element for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-start space-x-2">
          <textarea
            ref={inputRef}
            className="flex-1 min-h-[40px] max-h-32 px-3 py-2 rounded-md border border-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          
          <div className="flex space-x-2">
            <button
              className={cn(
                "p-2 rounded-full transition-colors",
                isLoading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              )}
              onClick={handleSendMessage}
              disabled={isLoading}
              title="Send message"
            >
              <FiSend />
            </button>
            
            <button
              className={cn(
                "p-2 rounded-full transition-colors",
                exportStatus === 'loading'
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : exportStatus === 'success'
                  ? "bg-green-500 text-white"
                  : exportStatus === 'error'
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              )}
              onClick={handleExportToMCP}
              disabled={exportStatus === 'loading' || messages.length === 0}
              title="Export to MCP"
            >
              {exportStatus === 'loading' ? <FiLoader className="animate-spin" /> : <FiDownload />}
            </button>
            
            <button
              className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              onClick={onShowAdvancedView}
              title="Advanced view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button> 
          </div>
        </div>
      </div>

      {/* MCP File Selection Modal */}
      <FileSelectionModal
        isOpen={isFileSelectionModalOpen}
        onClose={() => setIsFileSelectionModalOpen(false)}
        onSelectForMCP={handleFileSelected}
      />
    </div>
  );
}
