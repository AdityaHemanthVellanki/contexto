'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/store/useChatStore';
import { cn } from '@/utils/cn';
import NodePalette from './NodePalette';
import ChatPromptWindow from './ChatPromptWindow';
import PipelineSettings from './PipelineSettings';
import PipelineManager from '../pipeline/PipelineManager';

const tabs = [
  { id: 'nodePalette', label: 'Node Palette' },
  { id: 'chatPrompt', label: 'Chat Prompt' },
  { id: 'pipelineManager', label: 'Pipelines' },
  { id: 'pipelineSettings', label: 'Settings' },
];

export default function RightPanel() {
  const { activeTab, setActiveTab } = useChatStore();
  
  // Tailwind animation variants
  const tabVariants = {
    inactive: { opacity: 0.7, scale: 0.95 },
    active: { opacity: 1, scale: 1 }
  };
  
  const contentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={cn(
              'flex-1 py-3 px-4 text-sm font-medium transition-colors',
              activeTab === tab.id 
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
            variants={tabVariants}
            animate={activeTab === tab.id ? 'active' : 'inactive'}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(tab.id as any)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </motion.button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="h-full"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {activeTab === 'nodePalette' && <NodePalette />}
            {activeTab === 'chatPrompt' && <ChatPromptWindow />}
            {activeTab === 'pipelineManager' && <PipelineManager />}
            {activeTab === 'pipelineSettings' && <PipelineSettings />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
