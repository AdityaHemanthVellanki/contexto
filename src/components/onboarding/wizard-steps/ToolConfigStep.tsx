'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiLoader, FiTool, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

interface ToolConfigStepProps {
  onComplete: (tools: Tool[], autoGenerate: boolean) => void;
  initialTools?: Tool[];
  initialAutoGenerate?: boolean;
  description: string;
  fileIds: string[];
}

export default function ToolConfigStep({
  onComplete,
  initialTools = [],
  initialAutoGenerate = false,
  description,
  fileIds
}: ToolConfigStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [autoGenerate, setAutoGenerate] = useState(initialAutoGenerate);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>({
    name: '',
    description: '',
    parameters: []
  });
  const [currentParameter, setCurrentParameter] = useState<ToolParameter>({
    name: '',
    type: 'string',
    description: '',
    required: true
  });
  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null);
  const [editingParameterIndex, setEditingParameterIndex] = useState<number | null>(null);

  // Initialize with any existing tools
  useEffect(() => {
    if (initialTools.length > 0) {
      setTools(initialTools);
    }
  }, [initialTools]);

  const generateToolsFromContent = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/generateTools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileIds,
          description
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate tools: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.tools && Array.isArray(data.tools)) {
        setTools(data.tools);
        setAutoGenerate(true);
        
        toast({
          title: 'Tools Generated',
          description: `Successfully generated ${data.tools.length} tools based on your content`,
          variant: 'success'
        });
      } else {
        throw new Error('Invalid response format from tool generation');
      }
    } catch (error) {
      console.error('Tool generation error:', error);
      toast({
        title: 'Generation Error',
        description: error instanceof Error ? error.message : 'Failed to generate tools',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addTool = () => {
    if (!currentTool.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Tool name is required',
        variant: 'destructive'
      });
      return;
    }
    
    if (editingToolIndex !== null) {
      // Update existing tool
      setTools(prev => prev.map((tool, idx) => 
        idx === editingToolIndex ? currentTool : tool
      ));
      setEditingToolIndex(null);
    } else {
      // Add new tool
      setTools(prev => [...prev, currentTool]);
    }
    
    // Reset current tool
    setCurrentTool({
      name: '',
      description: '',
      parameters: []
    });
  };

  const editTool = (index: number) => {
    setCurrentTool(tools[index]);
    setEditingToolIndex(index);
  };

  const deleteTool = (index: number) => {
    setTools(prev => prev.filter((_, idx) => idx !== index));
    
    if (editingToolIndex === index) {
      setEditingToolIndex(null);
      setCurrentTool({
        name: '',
        description: '',
        parameters: []
      });
    }
  };

  const addParameter = () => {
    if (!currentParameter.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Parameter name is required',
        variant: 'destructive'
      });
      return;
    }
    
    if (editingParameterIndex !== null) {
      // Update existing parameter
      setCurrentTool(prev => ({
        ...prev,
        parameters: prev.parameters.map((param, idx) => 
          idx === editingParameterIndex ? currentParameter : param
        )
      }));
      setEditingParameterIndex(null);
    } else {
      // Add new parameter
      setCurrentTool(prev => ({
        ...prev,
        parameters: [...prev.parameters, currentParameter]
      }));
    }
    
    // Reset current parameter
    setCurrentParameter({
      name: '',
      type: 'string',
      description: '',
      required: true
    });
  };

  const editParameter = (index: number) => {
    setCurrentParameter(currentTool.parameters[index]);
    setEditingParameterIndex(index);
  };

  const deleteParameter = (index: number) => {
    setCurrentTool(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, idx) => idx !== index)
    }));
    
    if (editingParameterIndex === index) {
      setEditingParameterIndex(null);
      setCurrentParameter({
        name: '',
        type: 'string',
        description: '',
        required: true
      });
    }
  };

  const handleContinue = () => {
    onComplete(tools, autoGenerate);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tool Configuration</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Define the tools (commands/APIs) your MCP server will expose
        </p>
      </div>
      
      {/* Auto-generate toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Auto-generate Tools</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Let AI analyze your content and suggest appropriate tools
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoGenerate(!autoGenerate)}
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {autoGenerate ? <FiToggleRight className="h-6 w-6" /> : <FiToggleLeft className="h-6 w-6" />}
          </button>
          
          <button
            onClick={generateToolsFromContent}
            disabled={isGenerating || fileIds.length === 0 && !description}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center ${
              isGenerating || (fileIds.length === 0 && !description)
                ? 'bg-gray-300 text-gray-700 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400' 
                : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
            }`}
          >
            {isGenerating ? (
              <>
                <FiLoader className="animate-spin mr-1 h-3 w-3" />
                Generating...
              </>
            ) : (
              <>
                <FiTool className="mr-1 h-3 w-3" />
                Generate Tools
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Tools List */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Defined Tools</h4>
        
        {tools.length === 0 ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tools defined yet. Add tools manually or use auto-generate.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tools.map((tool, index) => (
              <div 
                key={`tool-${index}`}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">{tool.name}</h5>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editTool(index)}
                      className="p-1 text-blue-500 hover:text-blue-600 dark:text-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTool(index)}
                      className="p-1 text-red-500 hover:text-red-600 dark:text-red-400"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
                
                {tool.parameters.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Parameters:</p>
                    <ul className="mt-1 space-y-1">
                      {tool.parameters.map((param, paramIdx) => (
                        <li key={`param-${index}-${paramIdx}`} className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{param.name}</span>
                          <span className="text-gray-400 dark:text-gray-500"> ({param.type})</span>
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Add/Edit Tool Form */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {editingToolIndex !== null ? 'Edit Tool' : 'Add New Tool'}
        </h4>
        
        <div className="space-y-3">
          <div>
            <label htmlFor="toolName" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Tool Name*
            </label>
            <input
              id="toolName"
              type="text"
              value={currentTool.name}
              onChange={(e) => setCurrentTool(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
              placeholder="e.g., searchDatabase"
            />
          </div>
          
          <div>
            <label htmlFor="toolDescription" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="toolDescription"
              value={currentTool.description}
              onChange={(e) => setCurrentTool(prev => ({ ...prev, description: e.target.value }))}
              className="mt-1 w-full px-3 py-2 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
              placeholder="What does this tool do?"
              rows={2}
            />
          </div>
          
          {/* Parameters Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">Parameters</h5>
              <button
                onClick={addParameter}
                className="px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 flex items-center"
              >
                <FiPlus className="mr-1 h-3 w-3" />
                {editingParameterIndex !== null ? 'Update Parameter' : 'Add Parameter'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  value={currentParameter.name}
                  onChange={(e) => setCurrentParameter(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2 py-1 text-xs text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800"
                  placeholder="Parameter Name"
                />
              </div>
              
              <div>
                <select
                  value={currentParameter.type}
                  onChange={(e) => setCurrentParameter(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-2 py-1 text-xs text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                </select>
              </div>
              
              <div className="col-span-2">
                <input
                  type="text"
                  value={currentParameter.description}
                  onChange={(e) => setCurrentParameter(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-2 py-1 text-xs text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800"
                  placeholder="Parameter Description"
                />
              </div>
              
              <div className="col-span-2 flex items-center">
                <input
                  type="checkbox"
                  id="paramRequired"
                  checked={currentParameter.required}
                  onChange={(e) => setCurrentParameter(prev => ({ ...prev, required: e.target.checked }))}
                  className="h-3 w-3 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="paramRequired" className="ml-2 text-xs text-gray-700 dark:text-gray-300">
                  Required
                </label>
              </div>
            </div>
            
            {/* Parameter List */}
            {currentTool.parameters.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {currentTool.parameters.map((param, paramIdx) => (
                  <div 
                    key={`current-param-${paramIdx}`}
                    className="flex items-center justify-between p-1 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{param.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({param.type})</span>
                      {param.required && <span className="text-xs text-red-500">*</span>}
                    </div>
                    
                    <div className="flex space-x-1">
                      <button
                        onClick={() => editParameter(paramIdx)}
                        className="p-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteParameter(paramIdx)}
                        className="p-1 text-xs text-red-500 hover:text-red-600 dark:text-red-400"
                      >
                        <FiTrash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={addTool}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-md"
          >
            {editingToolIndex !== null ? 'Update Tool' : 'Add Tool'}
          </button>
        </div>
      </div>
    </div>
  );
}
