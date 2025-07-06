'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FiDatabase, 
  FiScissors, 
  FiCpu, 
  FiServer, 
  FiSearch, 
  FiMessageSquare
} from 'react-icons/fi';

// Node type definitions with icons, descriptions
const nodeTypes = {
  inputs: [
    {
      type: 'dataSource',
      label: 'Data Source',
      icon: <FiDatabase className="h-5 w-5" />,
      description: 'Import data from files, APIs, or text input',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    },
  ],
  processors: [
    {
      type: 'chunker',
      label: 'Chunker',
      icon: <FiScissors className="h-5 w-5" />,
      description: 'Split text into manageable chunks',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    },
    {
      type: 'embedder',
      label: 'Embedder',
      icon: <FiCpu className="h-5 w-5" />,
      description: 'Generate embeddings for text chunks',
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    },
    {
      type: 'indexer',
      label: 'Indexer',
      icon: <FiServer className="h-5 w-5" />,
      description: 'Store and index embeddings for retrieval',
      color: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
    },
    {
      type: 'retriever',
      label: 'Retriever',
      icon: <FiSearch className="h-5 w-5" />,
      description: 'Search and retrieve relevant content',
      color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    },
  ],
  outputs: [
    {
      type: 'output',
      label: 'Output',
      icon: <FiMessageSquare className="h-5 w-5" />,
      description: 'Present results or generate responses',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    },
  ],
};

// Draggable node card component
const NodeCard = ({ 
  type, 
  label, 
  icon, 
  description, 
  color 
}: {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}) => {
  // Handle drag start to set the node type
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card 
      className="mb-3 cursor-grab transition-all hover:shadow-md"
      draggable
      onDragStart={onDragStart}
    >
      <CardHeader className="p-3 flex flex-row items-center gap-3">
        <div className={`p-2 rounded-md ${color}`}>
          {icon}
        </div>
        <div>
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          <Badge variant="outline" className="mt-1 text-xs font-normal">
            {type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
};

export default function PaletteTab() {
  return (
    <div className="h-full">
      <h2 className="text-xl font-semibold mb-4">Node Palette</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Drag and drop nodes onto the canvas to build your pipeline.
      </p>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4 w-full grid grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="processors">Processors</TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-6 mt-0">
          <div>
            <h3 className="font-medium text-sm mb-3 text-muted-foreground uppercase tracking-wider">
              Input Nodes
            </h3>
            {nodeTypes.inputs.map((node) => (
              <NodeCard key={node.type} {...node} />
            ))}
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-3 text-muted-foreground uppercase tracking-wider">
              Processing Nodes
            </h3>
            {nodeTypes.processors.map((node) => (
              <NodeCard key={node.type} {...node} />
            ))}
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-3 text-muted-foreground uppercase tracking-wider">
              Output Nodes
            </h3>
            {nodeTypes.outputs.map((node) => (
              <NodeCard key={node.type} {...node} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="inputs" className="mt-0">
          {nodeTypes.inputs.map((node) => (
            <NodeCard key={node.type} {...node} />
          ))}
        </TabsContent>
        
        <TabsContent value="processors" className="mt-0">
          {nodeTypes.processors.map((node) => (
            <NodeCard key={node.type} {...node} />
          ))}
        </TabsContent>
        
        <TabsContent value="outputs" className="mt-0">
          {nodeTypes.outputs.map((node) => (
            <NodeCard key={node.type} {...node} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
