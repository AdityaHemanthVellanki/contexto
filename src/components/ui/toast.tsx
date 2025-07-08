'use client';

import { useEffect, createContext, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiXCircle, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // Duration in ms
}

export type ToastOptions = Omit<Toast, 'id'>

interface ToastContextType {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastComponent = ({ toast, onDismiss }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const getIcon = () => {
    switch (toast.variant) {
      case 'destructive':
        return <FiXCircle className="h-5 w-5 text-red-500" />;
      case 'success':
        return <FiCheck className="h-5 w-5 text-green-500" />;
      default:
        return <FiAlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getBgColor = () => {
    switch (toast.variant) {
      case 'destructive':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20';
      default:
        return 'bg-white dark:bg-gray-800';
    }
  };

  const getBorderColor = () => {
    switch (toast.variant) {
      case 'destructive':
        return 'border-red-200 dark:border-red-800';
      case 'success':
        return 'border-green-200 dark:border-green-800';
      default:
        return 'border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-lg border ${getBorderColor()} ${getBgColor()} shadow-md p-4 flex gap-3 min-w-[300px] max-w-md`}
    >
      <div className="mt-1">{getIcon()}</div>
      <div className="flex-1">
        <h3 className="font-medium text-sm">{toast.title}</h3>
        {toast.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-400 hover:text-gray-500"
      >
        <FiXCircle className="h-5 w-5" />
      </button>
    </motion.div>
  );
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Create a ToastProvider component that wraps the app with toast functionality
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (options: ToastOptions) => {
    const id = uuidv4();
    setToasts((prev) => [...prev, { id, ...options }]);
    return id;
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const dismissAll = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
