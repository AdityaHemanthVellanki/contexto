'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiDownload, FiSliders, FiLoader, FiBarChart2 } from 'react-icons/fi';
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !importedData || !activeFileId) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Get the auth token
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Authentication required');

      // Call our new query API
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          prompt: input.trim(),
          fileId: activeFileId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant message with usage report
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer || 'Sorry, I couldn\'t process that request.',
        timestamp: new Date(),
        usageReport: data.usageReport
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error querying data:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'Sorry, an error occurred while processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Show toast with error
      toast({
        title: 'Query Failed',
        description: error instanceof Error ? error.message : 'Failed to process your request',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle export of MCP server
  const handleExport = async () => {
    if (exportStatus === 'loading' || !activeFileId) return;
    
    setExportStatus('loading');
    try {
      // Get the auth token
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Authentication required');
      
      const response = await fetch('/api/exportMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fileId: activeFileId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export MCP server');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contexto-mcp-${activeFileId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportStatus('success');
      
      // Show success toast
      toast({
        title: 'MCP Server Ready',
        description: 'Your MCP server has been exported successfully',
        variant: 'success',
        duration: 3000
      });
      
      // Reset status after showing success briefly
      setTimeout(() => {
        setExportStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error exporting MCP server:', error);
      setExportStatus('error');
      
      // Show error toast
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export MCP server',
        variant: 'destructive',
        duration: 5000
      });
      
      // Reset status after showing error briefly
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };
  
  // Auto-resize textarea height as content grows
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'inherit';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto my-12 p-6">
      {/* Advanced View Toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onShowAdvancedView}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded-md"
          aria-label="Switch to advanced view"
        >
          <FiSliders className="mr-1.5 h-4 w-4" />
          Switch to Advanced View
        </button>
      </div>
      
      {/* Import Data Section */}
      {!importedData && (
        <div className="mb-6">
          <motion.button
            onClick={onImportData}
            className="w-full py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex flex-col items-center justify-center">
              <svg 
                className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Import Data
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Drop files or click to upload
              </p>
            </div>
          </motion.button>
        </div>
      )}
      
      {/* Chat Messages */}
      <div 
        className={cn(
          "flex-1 overflow-y-auto mb-4 space-y-4 rounded-lg",
          messages.length > 0 ? "border border-gray-200 dark:border-gray-700 p-4" : ""
        )}
        style={{ maxHeight: '60vh', minHeight: messages.length > 0 ? '300px' : '0px' }}
      >
        <AnimatePresence>
          {messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "p-3 rounded-lg max-w-[85%]",
                message.role === 'user' 
                  ? "bg-blue-100 dark:bg-blue-900/30 ml-auto text-gray-800 dark:text-gray-200" 
                  : "bg-gray-100 dark:bg-gray-800 mr-auto text-gray-800 dark:text-gray-200"
              )}
            >
              <div className="text-sm font-medium mb-1">
                {message.role === 'user' ? 'You' : 'Contexto AI'}
              </div>
              <div className="whitespace-pre-wrap text-sm">
                {message.content}
              </div>
              <div className="flex justify-between items-center mt-1">
                <div>
                  {message.usageReport && message.role === 'assistant' && (
                    <button 
                      onClick={() => setShowUsage(showUsage === message.id ? null : message.id)}
                      className="flex items-center text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <FiBarChart2 className="mr-1" />
                      Usage Stats
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              
              {/* Usage Report */}
              {showUsage === message.id && message.usageReport && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400"
                >
                  <div className="grid grid-cols-2 gap-1">
                    <span>Prompt Tokens:</span>
                    <span className="text-right">{message.usageReport.promptTokens}</span>
                    <span>Completion Tokens:</span>
                    <span className="text-right">{message.usageReport.completionTokens}</span>
                    <span>Total Tokens:</span>
                    <span className="text-right">{message.usageReport.totalTokens}</span>
                    <span>Latency:</span>
                    <span className="text-right">{message.usageReport.latencyMs}ms</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 mr-auto text-gray-500 dark:text-gray-400"
          >
            <FiLoader className="h-4 w-4 animate-spin" />
            <span>Contexto AI is thinking...</span>
          </motion.div>
        )}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={importedData && activeFileId ? "Ask Contexto about your data…" : "Import data first to start chatting..."}
          disabled={!importedData || !activeFileId || isLoading}
          className={cn(
            "w-full px-4 py-3 resize-none min-h-[60px] max-h-[200px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white",
            !importedData && "opacity-50 cursor-not-allowed"
          )}
          rows={1}
          aria-label="Chat message input"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading || !importedData || !activeFileId}
          className={cn(
            "absolute right-3 bottom-3 p-2 rounded-md transition-colors",
            input.trim() && importedData && activeFileId && !isLoading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
          )}
          aria-label="Send message"
        >
          <FiSend className="h-5 w-5" />
        </button>
      </form>
      
      {/* Export Button */}
      <div className="mt-4 flex justify-center">
        <motion.button
          onClick={handleExport}
          disabled={exportStatus === 'loading' || !importedData || !activeFileId}
          className={cn(
            "flex items-center justify-center px-4 py-2 text-sm rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
            importedData && activeFileId 
              ? "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-600 opacity-50 cursor-not-allowed"
          )}
          whileHover={importedData && activeFileId ? { scale: 1.03 } : {}}
          whileTap={importedData && activeFileId ? { scale: 0.97 } : {}}
          aria-label="Export MCP Pipeline"
        >
          <FiDownload className="mr-2 h-4 w-4" />
          {exportStatus === 'loading' ? (
            <>
              <FiLoader className="animate-spin h-4 w-4 mr-2" />
              Exporting...
            </>
          ) : exportStatus === 'success' ? (
            'Export Successful!'
          ) : exportStatus === 'error' ? (
            'Export Failed'
          ) : (
            'Export MCP Pipeline'
          )}
        </motion.button>
      </div>
    </div>
  );
}
