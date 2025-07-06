'use client';

import React, { useState, useEffect } from 'react';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import TabContainer from '@/components/tabs/TabContainer';
import CanvasArea from '@/components/canvas/CanvasArea';
import TestPanel from '@/components/panels/TestPanel';

interface SplitPaneLayoutProps {
  showTestPanel?: boolean;
  onToggleTestPanel?: () => void;
}

export default function SplitPaneLayout({ showTestPanel = false, onToggleTestPanel }: SplitPaneLayoutProps) {
  const [testPanelVisible, setTestPanelVisible] = useState(showTestPanel);
  const [testPanelHeight, setTestPanelHeight] = useState(300);
  
  // Sync the internal state with the prop
  useEffect(() => {
    setTestPanelVisible(showTestPanel);
  }, [showTestPanel]);
  
  const toggleTestPanel = () => {
    const newValue = !testPanelVisible;
    setTestPanelVisible(newValue);
    if (onToggleTestPanel) {
      onToggleTestPanel();
    }
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* Main content area */}
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        {/* Left panel - Canvas */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <div className="h-full flex flex-col">
            <CanvasArea />
          </div>
        </ResizablePanel>
        
        {/* Right panel - Tabs */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <TabContainer />
        </ResizablePanel>
      </ResizablePanelGroup>
      
      {/* Bottom test panel - collapsible */}
      {testPanelVisible && (
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel
            defaultSize={testPanelHeight}
            minSize={200}
            onResize={size => setTestPanelHeight(size)}
            className="bg-background border-t"
          >
            <TestPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      
      {/* Test panel toggle button */}
      <button
        onClick={toggleTestPanel}
        className="absolute bottom-4 right-4 bg-primary text-primary-foreground p-2 rounded-full shadow-md z-10 flex items-center justify-center w-10 h-10"
      >
        {testPanelVisible ? '↓' : '↑'}
      </button>
    </div>
  );
}
