'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import CanvasArea from '@/components/canvas/CanvasArea';
import RightPanel from '@/components/panels/RightPanel';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';
import { DashboardSkeleton } from '@/components/ui/SkeletonLoader';
import ChatInterface from '@/components/chat/ChatInterface';
import DataImportModal from '@/components/data/DataImportModal';
import FileList from '@/components/data/FileList';
import ExportList from '@/components/data/ExportList';
import ViewToggle from '@/components/layout/ViewToggle';
import { ToastContainer, useToast } from '@/components/ui/toast';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { PipelineGeneratorPage } from '@/components/pipeline/PipelineGeneratorPage';
import { FiUpload, FiFile, FiClock, FiDownload, FiPackage } from 'react-icons/fi';

// Import Firebase client
import { db } from '@/lib/firebase-client';

// Define animations
const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { initializeCanvas } = useCanvasStore();
  const { setActiveTab } = useChatStore();
  const { toast: addToast } = useToast();
  
  // State for the chat-centric layout
  const [activeView, setActiveView] = useState<'chat' | 'advanced' | 'pipeline'>('chat');
  const [importedData, setImportedData] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pipelineCount, setPipelineCount] = useState(0);
  
  // State for data management
  const [activeFileId, setActiveFileId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeDataTab, setActiveDataTab] = useState<'files' | 'exports'>('files');
  const [hasFilesLoaded, setHasFilesLoaded] = useState(false);
  
  // Set isLoading to false after initialization
  useEffect(() => {
    // Set a short timeout to ensure initial rendering is complete
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Initialize canvas when component loads
  useEffect(() => {
    initializeCanvas();
    setActiveTab('nodePalette'); // Using valid tab value
  }, [initializeCanvas, setActiveTab]);
  
  // Authentication and token refresh mechanism
  useEffect(() => {
    // If still loading auth state, don't do anything yet
    if (authLoading) {
      console.log('Auth state is still loading, waiting...');
      return;
    }

    // Once auth loading is complete, check if user exists
    if (!user) {
      console.log('No user found after auth loaded, redirecting to signin');
      router.push('/signin');
      return;
    }
    
    // If user is authenticated, implement token refresh mechanism
    if (user) {
      console.log('User authenticated in dashboard, setting up token refresh');
      
      // Immediate token refresh on page load to ensure fresh token
      (async () => {
        try {
          const token = await user.getIdToken(true);
          console.log('Token refreshed successfully on dashboard load');
          
          // Store token in sessionStorage for API calls
          sessionStorage.setItem('authToken', token);
        } catch (error) {
          console.error('Failed to refresh token on dashboard load:', error);
        }
      })();
      
      // Set up periodic token refresh (every 10 minutes)
      const tokenRefreshInterval = setInterval(async () => {
        try {
          if (user) {
            const token = await user.getIdToken(true);
            console.log('Periodic token refresh successful');
            sessionStorage.setItem('authToken', token);
          }
        } catch (error) {
          console.error('Periodic token refresh failed:', error);
        }
      }, 10 * 60 * 1000); // 10 minutes
      
      return () => {
        clearInterval(tokenRefreshInterval);
      };
    }
  }, [user, authLoading, router]);
  
  // Handle view toggle
  const handleViewChange = (view: 'chat' | 'advanced' | 'pipeline') => {
    setActiveView(view);
  };
  
  // Handle data import
  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };
  
  const handleImportSuccess = (fileId?: string) => {
    if (!fileId) return;
    
    // Set the newly imported file as active
    setActiveFileId(fileId);
    setImportedData(true);
    
    // Trigger refresh of file list
    setRefreshTrigger(prev => prev + 1);
    
    // Show success toast
    addToast({
      title: 'Import Successful',
      description: 'Your file is now ready for use',
      variant: 'success',
    });
  };

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setImportedData(true); // Mark that we have imported data when a file is selected
  };
  
  // Add effect to handle hasFilesLoaded state
  useEffect(() => {
    if (hasFilesLoaded && !activeFileId) {
      // This will trigger a refresh of the file list
      // which will auto-select the first file
      setRefreshTrigger(prev => prev + 1);
    }
  }, [hasFilesLoaded, activeFileId]);

  // Show loading state with skeleton
  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  // If authenticated, show the dashboard layout based on active view
  return (
    <div className="min-h-screen flex flex-col p-4 bg-gray-50 dark:bg-gray-900">
      <motion.div 
        className="w-full flex-1 flex flex-col"
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
      >
        {/* View Toggle in TopRight */}
        <div className="fixed top-20 right-4 z-40">
          <ViewToggle 
            activeView={activeView} 
            onViewChange={handleViewChange} 
            className="shadow-md" 
          />
        </div>
        
        {/* Toast Container */}
        <ToastContainer />
        
        {/* Data Import Modal */}
        <DataImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onImportSuccess={handleImportSuccess} 
        />
        
        <AnimatePresence mode="wait">
          {/* Chat-Centric View */}
          {activeView === 'chat' && (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex flex-col space-y-6">
                  {/* Data Files Section */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex-1 max-h-[500px] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => setActiveDataTab('files')}
                          className={`px-3 py-1.5 text-xs rounded-lg flex items-center ${activeDataTab === 'files' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                          <FiFile className="mr-1.5" /> Files
                        </button>
                        
                        <button
                          onClick={() => setActiveDataTab('exports')}
                          className={`px-3 py-1.5 text-xs rounded-lg flex items-center ${activeDataTab === 'exports' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                          <FiPackage className="mr-1.5" /> Exports
                        </button>
                      </div>
                      
                      <button
                        onClick={handleOpenImportModal}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center"
                      >
                        <FiUpload className="mr-1" /> Import New
                      </button>
                    </div>
                    
                    <AnimatePresence mode="wait">
                      {activeDataTab === 'files' ? (
                        <motion.div
                          key="files-tab"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <FileList
                            onSelectFile={handleFileSelect}
                            activeFileId={activeFileId}
                            refreshTrigger={refreshTrigger}
                            onFilesLoaded={(hasFiles) => {
                              // Update importedData state when files are loaded
                              setImportedData(hasFiles);
                              if (hasFiles && !activeFileId) {
                                // Auto-select the first file if none is selected
                                setHasFilesLoaded(true);
                              }
                            }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="exports-tab"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ExportList refreshTrigger={refreshTrigger} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <ChatInterface 
                    onShowAdvancedView={() => setActiveView('advanced')} 
                    importedData={importedData}
                    onImportData={handleOpenImportModal}
                    activeFileId={activeFileId}
                  />
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Advanced View */}
          {activeView === 'advanced' && (
            <motion.div 
              key="advanced-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
                  <p className="text-gray-600 dark:text-gray-400">Manage your data and build MCP pipelines</p>
                  
                  {/* Chat Builder CTA */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100"> New: Chat-Driven Pipeline Builder</h3>
                        <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">Build MCP pipelines through guided conversation - no technical knowledge required!</p>
                      </div>
                      <Link 
                        href="/chat" 
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Try Chat Builder
                      </Link>
                    </div>
                  </div>
                </div>
                
                {/* Main Content Area */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Left Column */}
                  <div className="md:col-span-2">
                    <CanvasArea />
                  </div>
                  
                  {/* Right Column */}
                  <div className="md:col-span-1">
                    <RightPanel />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Pipeline Generator View */}
          {activeView === 'pipeline' && (
            <motion.div
              key="pipeline-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <PipelineGeneratorPage className="h-full" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Footer */}
        <div className="mt-auto pt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} Contexto. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}
