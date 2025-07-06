'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PaletteTab from './PaletteTab';
import ChatPromptTab from './ChatPromptTab';
import SettingsTab from './SettingsTab';

export default function TabContainer() {
  const [activeTab, setActiveTab] = useState('palette');
  
  return (
    <div className="h-full flex flex-col p-4 bg-muted/10">
      <Tabs 
        defaultValue="palette" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full h-full flex flex-col"
      >
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="palette">Palette</TabsTrigger>
          <TabsTrigger value="chat">Chat Prompt</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <div className="flex-grow overflow-auto">
          <TabsContent value="palette" className="h-full mt-0">
            <PaletteTab />
          </TabsContent>
          
          <TabsContent value="chat" className="h-full mt-0">
            <ChatPromptTab />
          </TabsContent>
          
          <TabsContent value="settings" className="h-full mt-0">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
