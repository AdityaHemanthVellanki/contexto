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
  
  // Animation variants - smoother and more minimal
  const tabVariants = {
    inactive: { opacity: 0.6, y: 0 },
    active: { opacity: 1, y: 0 }
  };
  
  const contentVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Clean, Minimal Tabs */}
      <div className="flex justify-center px-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={cn(
              'py-3 px-3 mx-1 text-sm font-medium rounded-t-lg transition-all',
              activeTab === tab.id 
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            )}
            variants={tabVariants}
            animate={activeTab === tab.id ? 'active' : 'inactive'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(tab.id as any)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </motion.button>
        ))}
      </div>
      
      {/* Tab Content with Fade Transition */}
      <div className="flex-1 overflow-auto p-4">
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
