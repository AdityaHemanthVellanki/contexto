'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiMessageSquare, FiGrid } from 'react-icons/fi';
import { cn } from '@/utils/cn';

interface ViewToggleProps {
  activeView: 'chat' | 'advanced';
  onViewChange: (view: 'chat' | 'advanced') => void;
  className?: string;
}

export default function ViewToggle({ activeView, onViewChange, className }: ViewToggleProps) {
  const handleToggle = useCallback((view: 'chat' | 'advanced') => {
    if (view !== activeView) {
      onViewChange(view);
    }
  }, [activeView, onViewChange]);

  return (
    <div className={cn("flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1", className)}>
      <ViewButton
        icon={<FiMessageSquare />}
        label="Chat"
        isActive={activeView === 'chat'}
        onClick={() => handleToggle('chat')}
      />
      <ViewButton
        icon={<FiGrid />}
        label="Advanced"
        isActive={activeView === 'advanced'}
        onClick={() => handleToggle('advanced')}
      />
    </div>
  );
}

interface ViewButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ViewButton({ icon, label, isActive, onClick }: ViewButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
        isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <motion.div
          layoutId="activeViewIndicator"
          className="absolute inset-0 bg-white dark:bg-gray-700 rounded-md shadow-sm"
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        />
      )}
      <span className={cn("relative z-10 flex items-center")}>
        <span className="mr-1.5">{icon}</span>
        {label}
      </span>
    </button>
  );
}
