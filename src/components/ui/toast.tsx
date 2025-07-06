'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiXCircle, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { useToast, Toast } from '@/hooks/useToast';

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
