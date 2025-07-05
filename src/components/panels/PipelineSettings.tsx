'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiInfo, FiSave } from 'react-icons/fi';
import { useCanvasStore } from '@/store/useCanvasStore';
import { cn } from '@/utils/cn';

// API keys are now managed through environment variables

const configSettings = [
  {
    id: 'gridSnapEnabled',
    label: 'Enable Grid Snapping',
    type: 'toggle',
    description: 'Snap nodes to grid when moving them'
  },
  {
    id: 'gridSize',
    label: 'Grid Size',
    type: 'range',
    min: 5,
    max: 50,
    step: 5,
    description: 'Size of the grid cells in pixels'
  },
  {
    id: 'pipelineName',
    label: 'Pipeline Name',
    type: 'text',
    placeholder: 'My Awesome Pipeline',
    description: 'Name your pipeline for easier identification'
  }
];

export default function PipelineSettings() {
  const { canvasSettings, updateCanvasSettings } = useCanvasStore();
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSaveSettings = () => {
    // In a real implementation, you would save these settings to user preferences
    // and securely store API keys
    setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  };

  const handleSettingChange = (id: string, value: any) => {
    if (id === 'pipelineName') {
      updateCanvasSettings({ pipelineName: value });
    } else if (id === 'gridSnapEnabled') {
      updateCanvasSettings({ snapToGrid: value });
    } else if (id === 'gridSize') {
      updateCanvasSettings({ gridSize: value });
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Pipeline Settings</h2>
      
      {/* API Keys Section */}
      <section className="mb-8">
        <h3 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">API Keys</h3>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            API keys for Azure OpenAI and Firebase are managed through environment variables.
            No user input is required for API keys.
          </p>
        </div>
      </section>
      
      {/* Configuration Settings Section */}
      <section className="mb-8">
        <h3 className="text-md font-medium mb-3 text-gray-700 dark:text-gray-300">Configuration</h3>
        <div className="space-y-4">
          {configSettings.map((setting) => (
            <div key={setting.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {setting.label}
                </label>
                
                {setting.type === 'toggle' && (
                  <div className="relative inline-block w-12 h-6 rounded-full transition-colors duration-200">
                    <input
                      type="checkbox"
                      id={setting.id}
                      checked={canvasSettings.snapToGrid}
                      onChange={(e) => handleSettingChange(setting.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full transition-colors",
                        canvasSettings.snapToGrid 
                          ? "bg-blue-500" 
                          : "bg-gray-200 dark:bg-gray-700"
                      )}
                    ></div>
                    <div
                      className={cn(
                        "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform",
                        canvasSettings.snapToGrid && "translate-x-6"
                      )}
                    ></div>
                  </div>
                )}
              </div>
              
              {setting.type === 'range' && (
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    id={setting.id}
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    value={canvasSettings.gridSize}
                    onChange={(e) => handleSettingChange(setting.id, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {canvasSettings.gridSize}px
                  </span>
                </div>
              )}
              
              {setting.type === 'text' && (
                <input
                  type="text"
                  id={setting.id}
                  value={canvasSettings.pipelineName}
                  onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                  placeholder={setting.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800"
                />
              )}
              
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <FiInfo className="mr-1 inline-block" /> 
                {setting.description}
              </p>
            </div>
          ))}
        </div>
      </section>
      
      {/* Save Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSaveSettings}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-center space-x-2"
      >
        <FiSave className="w-4 h-4" />
        <span>Save Settings</span>
      </motion.button>
      
      {/* Feedback Message */}
      <AnimatedMessage message={saveMessage} />
    </div>
  );
}

// Animated feedback message component
function AnimatedMessage({ 
  message 
}: { 
  message: { type: 'success' | 'error', text: string } | null 
}) {
  if (!message) return null;
  
  const variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 }
  };
  
  const bgColor = message.type === 'success' ? 'bg-green-500' : 'bg-red-500';
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={variants}
      className={`fixed top-4 right-4 px-4 py-2 ${bgColor} text-white rounded-md shadow-lg`}
    >
      {message.text}
    </motion.div>
  );
}
