'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePipelineGenerator } from '@/hooks/usePipelineGenerator';
import { ChatMessage } from '@/types/pipeline';
import { cn } from '@/lib/utils';

interface PipelineGeneratorChatProps {
  onPipelineGenerated?: (pipelineJson: any) => void;
  onExportPipeline?: () => void;
  className?: string;
}

export function PipelineGeneratorChat({ 
  onPipelineGenerated, 
  onExportPipeline,
  className 
}: PipelineGeneratorChatProps) {
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    generatePipeline, 
    isLoading, 
    error, 
    chatHistory, 
    clearChatHistory 
  } = usePipelineGenerator();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const currentPrompt = prompt.trim();
    setPrompt('');

    try {
      const result = await generatePipeline(currentPrompt);
      
      // Notify parent component about the generated pipeline
      if (onPipelineGenerated) {
        onPipelineGenerated(result.pipelineJson);
      }
    } catch (error) {
      // Error is already handled in the hook
      console.error('Pipeline generation failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  const MessageBubble = ({ message }: { message: ChatMessage }) => {
    const isUser = message.role === 'user';
    const isError = message.content.includes('failed:');
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          'flex w-full mb-4',
          isUser ? 'justify-end' : 'justify-start'
        )}
      >
        <div
          className={cn(
            'max-w-[80%] rounded-lg px-4 py-2 shadow-sm',
            isUser 
              ? 'bg-blue-600 text-white' 
              : isError 
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={cn(
              'text-xs opacity-70',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}>
              {formatTimestamp(message.timestamp)}
            </span>
            {message.metadata?.pipelineGenerated && (
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Pipeline Generated
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Generate MCP Pipeline
          </CardTitle>
          <div className="flex items-center gap-2">
            {chatHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChatHistory}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {onExportPipeline && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPipeline}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export MCP
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the data sources, transformations, and retrieval you need…"
            disabled={isLoading}
            className="flex-1"
            aria-label="Pipeline description input"
          />
          <Button 
            type="submit" 
            disabled={!prompt.trim() || isLoading}
            className="px-3"
            aria-label="Generate pipeline"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {/* Chat History */}
        <AnimatePresence>
          {chatHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-4"
            >
              <ScrollArea 
                ref={scrollAreaRef}
                className="h-64 w-full pr-4"
              >
                <AnimatePresence>
                  {chatHistory.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </AnimatePresence>
                
                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start mb-4"
                  >
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Generating pipeline...
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error.message}
            </p>
          </motion.div>
        )}

        {/* Quick Examples */}
        {chatHistory.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Try these examples:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                "Create a pipeline to process PDF documents and answer questions about them",
                "Build a system to index web pages and provide semantic search",
                "Set up a pipeline for processing research papers with citation extraction"
              ].map((example, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-left h-auto p-2 text-xs"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
