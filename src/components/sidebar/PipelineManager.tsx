'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useCanvasStore } from '@/store/useCanvasStore';
import { FiPlus, FiMoreVertical, FiSave, FiFolder, FiCopy, FiTrash, FiEdit2, FiCheck } from 'react-icons/fi';
import { getAuth } from 'firebase/auth';
import { doc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

interface Pipeline {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  nodes: any[];
  edges: any[];
  userId: string;
}

export default function PipelineManager() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDescription, setNewPipelineDescription] = useState('');
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { nodes, edges, setNodes, setEdges } = useCanvasStore();
  const { toast } = useToast();
  const router = useRouter();
  const auth = getAuth();
  const db = getFirestore();
  
  // Load user's pipelines on component mount
  useEffect(() => {
    loadPipelines();
  }, []);
  
  // Load pipelines from Firebase
  const loadPipelines = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setPipelines([]);
        setLoading(false);
        return;
      }
      
      const pipelinesQuery = query(
        collection(db, 'pipelines'),
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(pipelinesQuery);
      const loadedPipelines: Pipeline[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedPipelines.push({
          id: doc.id,
          name: data.name,
          description: data.description || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          nodes: data.nodes || [],
          edges: data.edges || [],
          userId: data.userId
        });
      });
      
      // Sort pipelines by updated date (newest first)
      loadedPipelines.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
      setPipelines(loadedPipelines);
    } catch (error) {
      console.error('Error loading pipelines:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pipelines',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Save current pipeline
  const savePipeline = async (name: string, description: string, isNew = true) => {
    setIsSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to save pipelines',
          variant: 'destructive',
        });
        return;
      }
      
      const pipelineData = {
        name,
        description,
        nodes,
        edges,
        userId: user.uid,
        updatedAt: new Date()
      };
      
      if (isNew) {
        // Create new pipeline
        const docRef = await addDoc(collection(db, 'pipelines'), {
          ...pipelineData,
          createdAt: new Date(),
        });
        
        toast({
          title: 'Success',
          description: 'Pipeline saved successfully',
        });
        
        // Reload pipelines
        loadPipelines();
        
        // Reset form
        setNewPipelineName('');
        setNewPipelineDescription('');
      } else if (selectedPipeline) {
        // Update existing pipeline
        const pipelineRef = doc(db, 'pipelines', selectedPipeline.id);
        await updateDoc(pipelineRef, pipelineData);
        
        toast({
          title: 'Success',
          description: 'Pipeline updated successfully',
        });
        
        // Reload pipelines
        loadPipelines();
      }
    } catch (error) {
      console.error('Error saving pipeline:', error);
      toast({
        title: 'Error',
        description: 'Failed to save pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setSaveDialogOpen(false);
    }
  };
  
  // Load a pipeline into the canvas
  const loadPipeline = (pipeline: Pipeline) => {
    setNodes(pipeline.nodes);
    setEdges(pipeline.edges);
    setSelectedPipeline(pipeline);
    
    toast({
      title: 'Pipeline Loaded',
      description: `Loaded pipeline: ${pipeline.name}`,
    });
    
    // Navigate to the editor page if not already there
    router.push('/editor');
  };
  
  // Delete a pipeline
  const deletePipeline = async (pipeline: Pipeline) => {
    try {
      await deleteDoc(doc(db, 'pipelines', pipeline.id));
      
      toast({
        title: 'Pipeline Deleted',
        description: `Deleted pipeline: ${pipeline.name}`,
      });
      
      // Reset selected pipeline if it was deleted
      if (selectedPipeline?.id === pipeline.id) {
        setSelectedPipeline(null);
      }
      
      // Reload pipelines
      loadPipelines();
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete pipeline',
        variant: 'destructive',
      });
    }
  };
  
  // Duplicate a pipeline
  const duplicatePipeline = async (pipeline: Pipeline) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to duplicate pipelines',
          variant: 'destructive',
        });
        return;
      }
      
      const pipelineData = {
        name: `${pipeline.name} (Copy)`,
        description: pipeline.description,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'pipelines'), pipelineData);
      
      toast({
        title: 'Success',
        description: 'Pipeline duplicated successfully',
      });
      
      // Reload pipelines
      loadPipelines();
    } catch (error) {
      console.error('Error duplicating pipeline:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate pipeline',
        variant: 'destructive',
      });
    }
  };
  
  // Start renaming a pipeline
  const startRename = (pipeline: Pipeline) => {
    setIsRenaming(pipeline.id);
    setRenameValue(pipeline.name);
  };
  
  // Complete pipeline rename
  const completeRename = async (pipeline: Pipeline) => {
    if (!renameValue.trim()) {
      setIsRenaming(null);
      return;
    }
    
    try {
      const pipelineRef = doc(db, 'pipelines', pipeline.id);
      await updateDoc(pipelineRef, {
        name: renameValue,
        updatedAt: new Date()
      });
      
      toast({
        title: 'Pipeline Renamed',
        description: `Renamed to: ${renameValue}`,
      });
      
      // Update selected pipeline if it was renamed
      if (selectedPipeline?.id === pipeline.id) {
        setSelectedPipeline({
          ...selectedPipeline,
          name: renameValue,
          updatedAt: new Date()
        });
      }
      
      // Reload pipelines
      loadPipelines();
    } catch (error) {
      console.error('Error renaming pipeline:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(null);
    }
  };
  
  // Handle new pipeline creation
  const handleCreateNew = () => {
    setNodes([]);
    setEdges([]);
    setSelectedPipeline(null);
    
    // Navigate to the editor page if not already there
    router.push('/editor');
    
    toast({
      title: 'New Pipeline',
      description: 'Started a new pipeline',
    });
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">My Pipelines</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateNew}
            className="flex items-center gap-1"
          >
            <FiPlus className="h-4 w-4" />
            New
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => setSaveDialogOpen(true)}
            className="flex items-center gap-1"
            disabled={nodes.length === 0}
          >
            <FiSave className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-grow">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <span className="text-muted-foreground">Loading pipelines...</span>
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-48 gap-4">
            <FiFolder className="h-12 w-12 text-muted-foreground opacity-70" />
            <div className="text-center">
              <h3 className="font-medium mb-1">No pipelines yet</h3>
              <p className="text-sm text-muted-foreground">
                Create a new pipeline to get started
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleCreateNew}
              className="mt-2"
            >
              <FiPlus className="mr-2 h-4 w-4" />
              Create Pipeline
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {pipelines.map((pipeline) => (
              <Card
                key={pipeline.id}
                className={`transition-all hover:border-primary cursor-pointer ${
                  selectedPipeline?.id === pipeline.id
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
                onClick={() => loadPipeline(pipeline)}
              >
                <CardHeader className="p-3 pb-0">
                  <div className="flex justify-between items-start">
                    {isRenaming === pipeline.id ? (
                      <div className="flex gap-2 items-center w-full">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-7 py-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              completeRename(pipeline);
                              e.preventDefault();
                            } else if (e.key === 'Escape') {
                              setIsRenaming(null);
                              e.preventDefault();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            completeRename(pipeline);
                          }}
                        >
                          <FiCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                    )}
                    
                    {isRenaming !== pipeline.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <FiMoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(pipeline);
                            }}
                          >
                            <FiEdit2 className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicatePipeline(pipeline);
                            }}
                          >
                            <FiCopy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePipeline(pipeline);
                            }}
                          >
                            <FiTrash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                  <CardDescription className="text-xs line-clamp-2">
                    {pipeline.description || 'No description provided'}
                  </CardDescription>
                </CardContent>
                <CardFooter className="p-3 pt-0 flex justify-between items-center">
                  <div className="flex gap-2">
                    <span className="text-xs text-muted-foreground">
                      {pipeline.nodes.length} nodes
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {pipeline.edges.length} connections
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pipeline.updatedAt.toLocaleDateString()}
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Save Pipeline Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Pipeline</DialogTitle>
            <DialogDescription>
              Give your pipeline a name and description.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="My Awesome Pipeline"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input
                id="description"
                value={newPipelineDescription}
                onChange={(e) => setNewPipelineDescription(e.target.value)}
                placeholder="A brief description of what this pipeline does"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => savePipeline(newPipelineName, newPipelineDescription)}
              disabled={!newPipelineName.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Pipeline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
