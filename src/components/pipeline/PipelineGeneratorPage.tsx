'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Save, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { PipelineGeneratorChat } from '@/components/chat/PipelineGeneratorChat';
import CanvasArea from '@/components/canvas/CanvasArea';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useAuth } from '@/context/AuthContext';
import { savePipelineToFirebase } from '@/services/pipelines';

interface PipelineGeneratorPageProps {
  className?: string;
}

export function PipelineGeneratorPage({ className }: PipelineGeneratorPageProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastGeneratedPipeline, setLastGeneratedPipeline] = useState<any>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    nodes, 
    edges, 
    canvasSettings, 
    loadGeneratedPipeline,
    updateCanvasSettings 
  } = useCanvasStore();

  // Handle pipeline generation from chat
  const handlePipelineGenerated = useCallback((pipelineJson: any) => {
    try {
      // Load the generated pipeline into the canvas
      loadGeneratedPipeline(pipelineJson);
      setLastGeneratedPipeline(pipelineJson);
      
      toast({
        title: "Pipeline Generated Successfully",
        description: `Created ${pipelineJson.nodes?.length || 0} nodes and ${pipelineJson.edges?.length || 0} connections.`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to load generated pipeline:', error);
      toast({
        title: "Pipeline Load Failed",
        description: "There was an error loading the generated pipeline into the canvas.",
        variant: "destructive",
      });
    }
  }, [loadGeneratedPipeline, toast]);

  // Handle saving pipeline to Firebase
  const handleSavePipeline = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save your pipeline.",
        variant: "destructive",
      });
      return;
    }

    if (nodes.length === 0) {
      toast({
        title: "No Pipeline to Save",
        description: "Generate or create a pipeline first before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const pipelineData = {
        name: canvasSettings.pipelineName,
        description: `Pipeline with ${nodes.length} nodes and ${edges.length} connections`,
        nodes,
        edges,
        settings: canvasSettings,
        metadata: {
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      await savePipelineToFirebase(user.uid, pipelineData);
      
      toast({
        title: "Pipeline Saved",
        description: `"${canvasSettings.pipelineName}" has been saved to your account.`,
      });
    } catch (error) {
      console.error('Failed to save pipeline:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving your pipeline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, nodes, edges, canvasSettings, toast]);

  // Handle exporting pipeline as MCP specification
  const handleExportPipeline = useCallback(async () => {
    if (nodes.length === 0) {
      toast({
        title: "No Pipeline to Export",
        description: "Generate or create a pipeline first before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Create MCP specification from current pipeline
      const mcpSpec = {
        name: canvasSettings.pipelineName.toLowerCase().replace(/\s+/g, '-'),
        version: "1.0.0",
        description: `Generated MCP pipeline with ${nodes.length} components`,
        main: "src/index.ts",
        scripts: {
          build: "tsc",
          start: "node dist/index.js",
          dev: "tsx src/index.ts"
        },
        dependencies: {
          "@modelcontextprotocol/sdk": "^0.4.0",
          "zod": "^3.22.0"
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          "typescript": "^5.0.0",
          "tsx": "^4.0.0"
        },
        pipeline: {
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.data.type,
            config: node.data.settings,
            position: node.position
          })),
          edges: edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type
          })),
          metadata: {
            generatedAt: new Date().toISOString(),
            generator: "Contexto Pipeline Generator",
            version: "1.0.0"
          }
        }
      };

      // Create and download the MCP specification file
      const blob = new Blob([JSON.stringify(mcpSpec, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mcpSpec.name}-mcp-spec.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Pipeline Exported",
        description: `MCP specification downloaded as "${mcpSpec.name}-mcp-spec.json"`,
      });
    } catch (error) {
      console.error('Failed to export pipeline:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your pipeline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [nodes, edges, canvasSettings, toast]);

  return (
    <div className={`h-screen flex flex-col bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pipeline Generator
              </h1>
            </div>
            <Badge variant="secondary" className="ml-2">
              Beta
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {nodes.length} nodes • {edges.length} connections
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSavePipeline}
              disabled={isSaving || nodes.length === 0}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPipeline}
              disabled={isExporting || nodes.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export MCP'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-96 flex-shrink-0 border-r bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-4 flex-1 overflow-hidden">
            <PipelineGeneratorChat
              onPipelineGenerated={handlePipelineGenerated}
              onExportPipeline={handleExportPipeline}
              className="h-full"
            />
          </div>
        </div>

        {/* Canvas Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    {canvasSettings.pipelineName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {nodes.length === 0 ? 'Empty Canvas' : 'Pipeline Ready'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-full">
                <div className="h-full">
                  <CanvasArea />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 border-t bg-white dark:bg-gray-800 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>Ready to generate pipelines</span>
            {lastGeneratedPipeline && (
              <Badge variant="secondary" className="text-xs">
                Last generated: {new Date().toLocaleTimeString()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span>Signed in as {user.email}</span>
            )}
            <span>Contexto v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
