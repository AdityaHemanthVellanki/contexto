'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ReactFlowProvider } from 'reactflow';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SplitPaneLayout from '@/components/layout/SplitPaneLayout';
import PipelineManager from '@/components/sidebar/PipelineManager';
import CodeExportModal from '@/components/modals/CodeExportModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { FiSave, FiCode, FiPlay, FiX } from 'react-icons/fi';
import { useCanvasStore } from '@/store/useCanvasStore';
import { doc, collection, addDoc, updateDoc, getFirestore, serverTimestamp } from 'firebase/firestore';

export default function EditorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  
  const { nodes, edges, selectedNode, canvasSettings, updateCanvasSettings } = useCanvasStore();
  const { toast } = useToast();
  const auth = getAuth();
  const db = getFirestore();
  
  // Check authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
      
      // If not logged in and not in development mode, redirect to login
      if (!currentUser && process.env.NODE_ENV !== 'development') {
        window.location.href = '/login';
      }
    });
    
    return () => unsubscribe();
  }, [auth]);
  
  // Handle save pipeline
  const handleSavePipeline = async () => {
    if (nodes.length === 0) {
      toast({
        title: 'Cannot Save',
        description: 'Add at least one node to your pipeline before saving',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Ensure user is logged in
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to save your pipeline',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }
      
      const pipelineData = {
        name: canvasSettings.pipelineName,
        nodes,
        edges,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'pipelines'), {
        ...pipelineData,
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: 'Pipeline Saved',
        description: 'Your pipeline has been saved successfully',
      });
      
      // Switch to manage tab to show the saved pipeline
      setActiveTab('manage');
      
    } catch (error) {
      console.error('Error saving pipeline:', error);
      toast({
        title: 'Save Failed',
        description: 'There was an error saving your pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle run pipeline
  const handleRunPipeline = () => {
    if (nodes.length === 0) {
      toast({
        title: 'Cannot Run',
        description: 'Add at least one node to your pipeline before running',
        variant: 'destructive',
      });
      return;
    }
    
    setShowTestPanel(true);
    toast({
      title: 'Test Panel Opened',
      description: 'Use the test panel to run your pipeline',
    });
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-[600px] space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-12 w-2/3 mx-auto" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header with tabs and actions */}
      <header className="flex justify-between items-center border-b p-3 bg-background">
        <div className="flex items-center gap-4">
          <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="editor">Pipeline Editor</TabsTrigger>
              <TabsTrigger value="manage">Manage Pipelines</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {activeTab === 'editor' && (
            <input
              type="text"
              value={canvasSettings.pipelineName}
              onChange={(e) => updateCanvasSettings({ pipelineName: e.target.value })}
              className="border border-input bg-background px-3 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Pipeline Name"
            />
          )}
        </div>
        
        {activeTab === 'editor' && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={handleSavePipeline}
              disabled={isSaving || nodes.length === 0}
            >
              <FiSave className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => setIsExportModalOpen(true)}
              disabled={nodes.length === 0}
            >
              <FiCode className="w-4 h-4" />
              Export Code
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={handleRunPipeline}
              disabled={isRunning || nodes.length === 0}
            >
              <FiPlay className="w-4 h-4" />
              Run Pipeline
            </Button>
          </div>
        )}
      </header>
      
      {/* Main content */}
      <div className="flex-grow overflow-hidden">
        <TabsContent value="editor" className="h-full m-0 p-0">
          <ReactFlowProvider>
            <SplitPaneLayout showTestPanel={showTestPanel} onToggleTestPanel={() => setShowTestPanel(!showTestPanel)} />
          </ReactFlowProvider>
        </TabsContent>
        
        <TabsContent value="manage" className="h-full m-0 p-4">
          <PipelineManager />
        </TabsContent>
      </div>
      
      {/* Code Export Modal */}
      <CodeExportModal 
        open={isExportModalOpen} 
        onOpenChange={setIsExportModalOpen} 
      />
    </div>
  );
}
