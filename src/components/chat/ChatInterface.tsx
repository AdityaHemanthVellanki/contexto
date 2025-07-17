'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiDownload, FiLoader, FiBarChart2, FiFile, FiChevronDown, FiChevronRight } from 'react-icons/fi';
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
  retrievedContext?: string[];
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
  const [expandedContext, setExpandedContext] = useState<string | null>(null);
  const [isFileSelectionModalOpen, setIsFileSelectionModalOpen] = useState(false);
  const [mcpFileId, setMcpFileId] = useState<string | undefined>(undefined);
  
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

      // Determine which endpoint to use - MCP pipeline or standard query
      const endpoint = '/api/process';
      const requestBody = {
        fileId: activeFileId,
        question: input.trim()
      };
      
      console.log(`Processing question with MCP pipeline for file ${activeFileId}`);
      
      // Call our API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer || 'Sorry, I couldn\'t process that request.',
        timestamp: new Date(),
        // Add retrieved chunks for context display
        retrievedContext: data.retrieved || [],
        // Add usage as part of the message metadata
        usageReport: {
          promptTokens: data.promptTokens || 0,
          completionTokens: data.completionTokens || 0,
          totalTokens: (data.promptTokens || 0) + (data.completionTokens || 0),
          latencyMs: 0 // We could add this from the server later
        }
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
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Open file selection modal for MCP discussions
  const handleOpenFileSelectionModal = () => {
    setIsFileSelectionModalOpen(true);
  };
  
  // Handle file selection for MCP discussions
  const handleSelectFileForMCP = (fileId: string) => {
    setMcpFileId(fileId);
    setIsFileSelectionModalOpen(false);
    
    toast({
      title: 'File Selected for MCP',
      description: 'You can now export this file for MCP pipeline processing',
      variant: 'default',
    });
  };
  
  // Handle export of MCP server
  const handleExport = async () => {
    if (!importedData || (!mcpFileId && !activeFileId)) return;
    
    setExportStatus('loading');
    
    try {
      // Get the auth token
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Authentication required');
      
      // Prioritize the MCP selected file if available, fall back to active file
      const fileIdToExport = mcpFileId || activeFileId;
      
      // Filter out system messages for export
      const filteredMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      
      // Call export API
      const response = await fetch('/api/exportMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fileId: fileIdToExport,
          messages: filteredMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export');
      }
      
      // Handle successful export
      setExportStatus('success');
      
      toast({
        title: 'Export Successful',
        description: 'Your MCP pipeline has been exported successfully',
        variant: 'default',
      });
      
      // Reset status after a delay
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export MCP pipeline',
        variant: 'destructive',
      });
      
      // Reset status after a delay
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };
  
  // Helper function to check if file is ready for querying
  const isFileReady = () => {
    return importedData && activeFileId && !isLoading;
  };
  
  // Auto-resize textarea height as content grows
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
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
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      {/* Message History */}
      <div className="flex-grow overflow-y-auto px-2 md:px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-10 text-gray-500 dark:text-gray-400"
            >
              <div className="mb-2">
                <FiBarChart2 className="mx-auto h-10 w-10 mb-2" />
                <h3 className="text-lg font-medium">Your Contexto Chat</h3>
              </div>
              <p>Ask questions about your imported data.</p>
              <p className="text-sm mt-4">
                {!importedData ? (
                  <button 
                    onClick={onImportData}
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Import data
                  </button>
                ) : (
                  "Start by typing a question below."
                )}
              </p>
            </motion.div>
          ) : (
            messages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "p-4 rounded-lg max-w-[85%] break-words",
                  message.role === "user" 
                    ? "bg-blue-100 dark:bg-blue-900 dark:text-white ml-auto" 
                    : "bg-gray-100 dark:bg-gray-800 dark:text-white"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {message.role === "user" ? "You" : "Contexto"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                {/* Message content with white-space preserved */}
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Retrieved context chunks display */}
                {message.role === 'assistant' && message.retrievedContext && message.retrievedContext.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setExpandedContext(expandedContext === message.id ? null : message.id)}
                      className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      {expandedContext === message.id ? (
                        <FiChevronDown className="mr-1 h-3 w-3" />
                      ) : (
                        <FiChevronRight className="mr-1 h-3 w-3" />
                      )}
                      <span>{message.retrievedContext.length} source chunk{message.retrievedContext.length !== 1 ? 's' : ''} used</span>
                    </button>
                    
                    {expandedContext === message.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2 text-sm max-h-60 overflow-y-auto"
                      >
                        {message.retrievedContext.map((chunk, index) => (
                          <div key={index} className="p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                            <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-1">Source {index + 1}</div>
                            <div className="text-gray-800 dark:text-gray-200 text-xs">{chunk}</div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}
                
                {/* Usage report toggle */}
                {message.role === 'assistant' && message.usageReport && (
                  <div className="mt-2 text-xs">
                    <button
                      onClick={() => setShowUsage(showUsage === message.id ? null : message.id)}
                      className="text-gray-500 dark:text-gray-400 hover:underline flex items-center"
                    >
                      <FiBarChart2 className="mr-1 h-3 w-3" />
                      {showUsage === message.id ? 'Hide Stats' : 'Show Stats'}
                    </button>
                    
                    {showUsage === message.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 bg-gray-200 dark:bg-gray-700 p-2 rounded text-gray-600 dark:text-gray-300"
                      >
                        <div>Prompt tokens:</div>
                        <div className="text-right">{message.usageReport.promptTokens}</div>
                        <div>Completion tokens:</div>
                        <div className="text-right">{message.usageReport.completionTokens}</div>
                        <div>Total tokens:</div>
                        <div className="text-right">{message.usageReport.totalTokens}</div>
                        <div>Latency:</div>
                        <div className="text-right">{message.usageReport.latencyMs}ms</div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 max-w-[85%]"
          >
            <div className="flex space-x-1">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                className="h-2 w-2 rounded-full bg-blue-500"
              />
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                className="h-2 w-2 rounded-full bg-blue-500"
              />
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                className="h-2 w-2 rounded-full bg-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Contexto is thinking...</span>
          </motion.div>
        )}
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
      
      {/* Action Buttons */}
      <div className="mt-4 flex justify-center space-x-3">
        {/* MCP File Selection Button */}
        <motion.button
          onClick={handleOpenFileSelectionModal}
          disabled={!importedData}
          className={cn(
            "flex items-center justify-center px-4 py-2 text-sm rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
            importedData
              ? "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-600 opacity-50 cursor-not-allowed"
          )}
          whileHover={importedData ? { scale: 1.03 } : {}}
          whileTap={importedData ? { scale: 0.97 } : {}}
          aria-label="Select File for MCP Discussion"
        >
          <FiFile className="mr-2 h-4 w-4" />
          {mcpFileId ? 'Change MCP File' : 'Select File for MCP'}
        </motion.button>

        {/* Export Button */}
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
            <>
              <FiDownload className="mr-2 h-4 w-4" />
              Export MCP Pipeline
            </>
          )}
        </motion.button>
      </div>
      
      {/* File Selection Modal */}
      {isFileSelectionModalOpen && (
        <FileSelectionModal 
          isOpen={isFileSelectionModalOpen}
          onClose={() => setIsFileSelectionModalOpen(false)}
          onSelectForMCP={handleSelectFileForMCP}
        />
      )}
    </div>
  );
}
