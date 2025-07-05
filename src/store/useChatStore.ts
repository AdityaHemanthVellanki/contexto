import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  userPrompt: string;
  isDrawerOpen: boolean;
  activeTab: 'nodePalette' | 'chatPrompt' | 'pipelineManager' | 'pipelineSettings';
  activeNodeId: string | null;
  
  // Actions
  setUserPrompt: (prompt: string) => void;
  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => void;
  clearMessages: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'nodePalette' | 'chatPrompt' | 'pipelineManager' | 'pipelineSettings') => void;
  setActiveNodeId: (nodeId: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isGenerating: false,
  userPrompt: '',
  isDrawerOpen: false,
  activeTab: 'nodePalette',
  activeNodeId: null,
  
  // Set the current user prompt
  setUserPrompt: (prompt) => set({ userPrompt: prompt }),
  
  // Add a new message to the chat
  addMessage: (role, content) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now()
    };
    
    set({ messages: [...get().messages, newMessage] });
    
    // If it's a user message, also clear the prompt
    if (role === 'user') {
      set({ userPrompt: '' });
    }
  },
  
  // Clear all messages
  clearMessages: () => set({ messages: [] }),
  
  // Set the generating state (when waiting for AI response)
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  
  // Set the drawer open state (for node configuration drawer)
  setIsDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
  
  // Set the active tab in the right panel
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Set the active node ID when a node is selected
  setActiveNodeId: (nodeId) => set({ activeNodeId: nodeId }),
}));
