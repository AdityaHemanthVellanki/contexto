'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { FiCopy, FiCheck, FiDownload } from 'react-icons/fi';
import { useCanvasStore } from '@/store/useCanvasStore';
import { generatePipelineCode } from '@/utils/pipelineCodeGenerator';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { nightOwl, prism } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from 'next-themes';

interface CodeExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CodeExportModal({ open, onOpenChange }: CodeExportModalProps) {
  const { nodes, edges, canvasSettings } = useCanvasStore();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'typescript' | 'javascript'>('typescript');
  const [copied, setCopied] = useState(false);
  
  // Generate code based on active tab format
  const generatedCode = generatePipelineCode(nodes, edges, {
    format: activeTab,
    includeImports: true,
    includeComments: true,
  });
  
  // Copy code to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Code copied to clipboard',
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      toast({
        title: 'Copy failed',
        description: 'Could not copy code to clipboard',
        variant: 'destructive',
      });
    }
  };
  
  // Download code as file
  const handleDownload = () => {
    try {
      // Create a Blob with the code
      const blob = new Blob([generatedCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and click it
      const link = document.createElement('a');
      const fileName = `${canvasSettings.pipelineName.toLowerCase().replace(/\s+/g, '-')}.${activeTab === 'typescript' ? 'ts' : 'js'}`;
      
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Downloaded!',
        description: `Saved as ${fileName}`,
      });
    } catch (err) {
      console.error('Failed to download code:', err);
      toast({
        title: 'Download failed',
        description: 'Could not download the file',
        variant: 'destructive',
      });
    }
  };
  
  // Determine the syntax highlighter style based on theme
  const codeStyle = theme === 'dark' ? nightOwl : prism;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Pipeline Code</DialogTitle>
          <DialogDescription>
            Generated code for your pipeline that can be used in your project.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs 
          defaultValue="typescript" 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as 'typescript' | 'javascript')}
          className="w-full"
        >
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1"
                onClick={handleCopy}
              >
                {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-1"
                onClick={handleDownload}
              >
                <FiDownload className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
          
          <div className="border rounded-md overflow-hidden overflow-y-auto max-h-[50vh]">
            <TabsContent value="typescript" className="mt-0 p-0">
              <SyntaxHighlighter 
                language="typescript" 
                style={codeStyle}
                customStyle={{ margin: 0 }}
                className="text-sm"
                showLineNumbers={true}
              >
                {generatedCode}
              </SyntaxHighlighter>
            </TabsContent>
            
            <TabsContent value="javascript" className="mt-0 p-0">
              <SyntaxHighlighter 
                language="javascript" 
                style={codeStyle}
                customStyle={{ margin: 0 }}
                className="text-sm"
                showLineNumbers={true}
              >
                {generatedCode}
              </SyntaxHighlighter>
            </TabsContent>
          </div>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <div className="text-sm text-muted-foreground">
            This code requires the Contexto services to be installed in your project.
          </div>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
