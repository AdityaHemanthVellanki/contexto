import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FileList from '@/components/data/FileList';
import { FiX } from 'react-icons/fi';

interface FileSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForMCP: (fileId: string) => void;
}

export default function FileSelectionModal({
  isOpen,
  onClose,
  onSelectForMCP
}: FileSelectionModalProps) {
  const handleSelectForMCP = (fileId: string) => {
    onSelectForMCP(fileId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Select a file for MCP discussion</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <FiX className="h-4 w-4" />
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <FileList
            onSelectFile={() => {}} // No-op for regular selection
            selectionMode="mcp"
            onSelectForMCP={handleSelectForMCP}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
