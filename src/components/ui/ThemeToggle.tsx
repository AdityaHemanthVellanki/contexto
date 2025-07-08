'use client';

import { useTheme } from '@/context/ThemeContext';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-md transition-colors
                 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                 hover:bg-gray-100 dark:hover:bg-gray-800 ${className || ''}`}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      
      {/* Light mode icon */}
      <motion.div
        initial={{ opacity: 0, rotate: -30, scale: 0.5 }}
        animate={{ 
          opacity: theme === 'light' ? 1 : 0,
          rotate: theme === 'light' ? 0 : -30,
          scale: theme === 'light' ? 1 : 0.5
        }}
        transition={{ duration: 0.2 }}
        className="absolute"
      >
        <FiSun className="h-5 w-5" />
      </motion.div>
      
      {/* Dark mode icon */}
      <motion.div
        initial={{ opacity: 0, rotate: 30, scale: 0.5 }}
        animate={{ 
          opacity: theme === 'dark' ? 1 : 0,
          rotate: theme === 'dark' ? 0 : 30,
          scale: theme === 'dark' ? 1 : 0.5
        }}
        transition={{ duration: 0.2 }}
        className="absolute"
      >
        <FiMoon className="h-5 w-5" />
      </motion.div>
      
      {/* Transparent placeholder for button sizing */}
      <span className="opacity-0">
        <FiSun className="h-5 w-5" />
      </span>
    </button>
  );
}
