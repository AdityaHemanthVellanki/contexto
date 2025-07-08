import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiInfo, FiCode } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

interface WelcomeBannerProps {
  pipelineCount?: number;
  className?: string;
}

export default function WelcomeBanner({ pipelineCount = 0, className }: WelcomeBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { user } = useAuth();
  
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'there';
  
  if (!isVisible) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 
                    backdrop-blur-sm rounded-lg border border-blue-100 dark:border-blue-800 p-4 mb-6 overflow-hidden shadow-sm ${className}`}
      >
        {/* Close button */}
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Dismiss"
        >
          <FiX className="w-4 h-4" />
        </button>
        
        {/* Background decorative elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 opacity-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 opacity-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600" />
        
        {/* Content */}
        <div className="relative">
          <div className="flex items-start">
            <div className="bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-4">
              <FiInfo className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h3 className="font-medium text-lg text-gray-900 dark:text-gray-100">
                Welcome back, {displayName}!
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {pipelineCount > 0 
                  ? `You have ${pipelineCount} pipeline${pipelineCount !== 1 ? 's' : ''} ready to use.` 
                  : 'Get started by creating your first AI context pipeline.'}
              </p>
            </div>
          </div>
          
          {/* Stats or quick actions */}
          <div className="mt-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-md p-3 border border-blue-50 dark:border-blue-900/30">
            <div className="flex items-center">
              <FiCode className="mr-2 text-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {pipelineCount > 0 
                  ? 'Continue working on your pipelines or create a new one.' 
                  : 'Start by adding nodes from the Node Palette to build your first pipeline.'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
