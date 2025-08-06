'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUpload, FiTool, FiCheck, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/toast';
import { FileUploadStep, ToolConfigStep, ReviewLaunchStep } from './wizard-steps';
import PipelineProgress from '../pipeline/PipelineProgress';
import MCPChatInterface from '../chat/MCPChatInterface';

interface MCPWizardProps {
  onComplete: (pipelineId: string) => void;
  onCancel?: () => void;
}

interface Tool {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
}

export default function MCPWizard({ onComplete, onCancel }: MCPWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Data collected through the wizard
  const [wizardData, setWizardData] = useState({
    // Step 1: File Upload
    fileIds: [] as string[],
    fileNames: [] as string[],
    description: '',
    
    // Step 2: Tool Configuration
    tools: [] as Tool[],
    autoGenerateTools: false,
    
    // Step 3: Review & Launch
    pipelineName: `MCP Pipeline ${new Date().toLocaleDateString()}`,
  });

  // Step validation
  const isStep1Valid = wizardData.fileIds.length > 0 || wizardData.description.trim().length > 0;
  const isStep2Valid = true; // Tools are optional
  const isStep3Valid = true; // Review step is always valid if previous steps are valid

  // Step completion handlers
  const handleFileUploadComplete = (fileIds: string[], fileNames: string[], description: string) => {
    setWizardData(prev => ({
      ...prev,
      fileIds,
      fileNames,
      description
    }));
    setCurrentStep(1);
  };

  const handleToolConfigComplete = (tools: Tool[], autoGenerate: boolean) => {
    setWizardData(prev => ({
      ...prev,
      tools,
      autoGenerateTools: autoGenerate
    }));
    setCurrentStep(2);
  };

  const handlePipelineNameChange = (name: string) => {
    setWizardData(prev => ({
      ...prev,
      pipelineName: name
    }));
  };

  const handleLaunchPipeline = async () => {
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be signed in to create a pipeline'
      });
      return;
    }
    
    if (wizardData.fileIds.length === 0 && !wizardData.description) {
      toast({
        title: 'Validation Error',
        description: 'You must upload files or provide a description'
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/processPipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileIds: wizardData.fileIds,
          description: wizardData.description,
          tools: wizardData.tools,
          autoGenerateTools: wizardData.autoGenerateTools,
          name: wizardData.pipelineName
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start pipeline: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.pipelineId) {
        setPipelineId(data.pipelineId);
        setShowProgress(true);
        
        toast({
          title: 'Pipeline Started',
          description: 'Your MCP pipeline is now processing'
        });
      } else {
        throw new Error('No pipeline ID returned from server');
      }
    } catch (error) {
      console.error('Pipeline launch error:', error);
      toast({
        title: 'Pipeline Error',
        description: error instanceof Error ? error.message : 'Failed to start pipeline processing'
      });
      setIsProcessing(false);
    }
  };
  
  const handlePipelineComplete = () => {
    setIsProcessing(false);
    setShowProgress(false);
    setShowChat(true);
  };

  const handleChatComplete = () => {
    if (pipelineId) {
      onComplete(pipelineId);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (showProgress && pipelineId) {
    return <PipelineProgress pipelineId={pipelineId} onComplete={handlePipelineComplete} />;
  }

  if (showChat && pipelineId) {
    return (
      <MCPChatInterface 
        pipelineId={pipelineId} 
        pipelineName={wizardData.pipelineName}
        onDeploy={handleChatComplete}
        onExport={handleChatComplete}
      />
    );
  }

  // Step components
  const steps = [
    {
      title: 'Upload or Describe',
      icon: <FiUpload className="h-6 w-6" />,
      component: (
        <FileUploadStep
          onComplete={handleFileUploadComplete}
          initialFileIds={wizardData.fileIds}
          initialFileNames={wizardData.fileNames}
          initialDescription={wizardData.description}
        />
      ),
      isValid: isStep1Valid
    },
    {
      title: 'Tool Configuration',
      icon: <FiTool className="h-6 w-6" />,
      component: (
        <ToolConfigStep
          onComplete={handleToolConfigComplete}
          initialTools={wizardData.tools}
          initialAutoGenerate={wizardData.autoGenerateTools}
          description={wizardData.description}
          fileIds={wizardData.fileIds}
        />
      ),
      isValid: isStep2Valid
    },
    {
      title: 'Review & Launch',
      icon: <FiCheck className="h-6 w-6" />,
      component: (
        <ReviewLaunchStep
          fileNames={wizardData.fileNames}
          description={wizardData.description}
          tools={wizardData.tools}
          autoGenerateTools={wizardData.autoGenerateTools}
          isProcessing={isProcessing}
          onLaunch={handleLaunchPipeline}
          onNameChange={handlePipelineNameChange}
        />
      ),
      isValid: isStep3Valid
    }
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create New MCP Pipeline</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Follow these steps to create your Model Context Protocol server
        </p>
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              index < currentStep 
                ? 'bg-blue-500 text-white' 
                : index === currentStep 
                  ? 'bg-blue-100 text-blue-500 dark:bg-blue-900' 
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
            }`}>
              {index < currentStep ? <FiCheck className="h-5 w-5" /> : step.icon}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              index <= currentStep 
                ? 'text-gray-900 dark:text-white' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div className="w-12 h-1 mx-4 bg-gray-200 dark:bg-gray-700">
                <div className={`h-full ${index < currentStep ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} 
                     style={{ width: index < currentStep ? '100%' : '0%' }}></div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Step Content */}
      <div className="flex-grow p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {steps[currentStep].component}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <button
          onClick={currentStep === 0 && onCancel ? onCancel : handleBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {currentStep === 0 && onCancel ? 'Cancel' : (
            <span className="flex items-center">
              <FiArrowLeft className="mr-2" /> Back
            </span>
          )}
        </button>
        
        {currentStep < 2 ? (
          <button
            onClick={handleNext}
            disabled={!steps[currentStep].isValid || isProcessing}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm flex items-center ${
              !steps[currentStep].isValid || isProcessing
                ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Next
            <FiArrowRight className="ml-2 h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleLaunchPipeline}
            disabled={isProcessing}
            className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${
              isProcessing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Launch Pipeline'}
          </button>
        )}
      </div>
    </div>
  );
}
