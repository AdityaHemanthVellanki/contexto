'use client';

// React state management hooks for dashboard functionality
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import ChatSidebar from '@/components/chat/ChatSidebar';
import SimpleChatWindow from '@/components/chat/SimpleChatWindow';
import Link from 'next/link';
import { DocumentTextIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  // React useState hooks for chat state management
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0); // Force re-render of chat component
  
  // React useEffect hook for authentication state management
  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      console.log('No user found, redirecting to signin');
      router.push('/signin');
      return;
    }
    
    console.log('User authenticated, dashboard ready');
  }, [user, authLoading, router]);

  // Create a new chat session
  const handleNewChat = async () => {
    if (!user?.uid) return;

    try {
      const chatsRef = collection(db, 'conversations', user.uid, 'chats');
      const newChatDoc = await addDoc(chatsRef, {
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messageCount: 0
      });
      
      setActiveChatId(newChatDoc.id);
      setChatKey(prev => prev + 1); // Force chat component to reset
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  // Handle chat selection
  const handleChatSelect = (chatId: string) => {
    setActiveChatId(chatId);
    setChatKey(prev => prev + 1); // Force chat component to reload with new chat
  };
  
  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }
  
  // Show signin redirect if no user
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="text-gray-500 dark:text-gray-400">
          Redirecting to sign in...
        </div>
      </div>
    );
  }
  
  // Render multi-chat dashboard
  return (
    <div className="flex h-screen bg-white dark:bg-black">
      {/* Chat Sidebar */}
      <ChatSidebar
        activeChatId={activeChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Contexto
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              MCP Pipeline Builder
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href="/files"
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Files
            </Link>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              <Cog6ToothIcon className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
        
        {/* Chat Window */}
        <div className="flex-1">
          <SimpleChatWindow key={`${activeChatId}-${chatKey}`} chatId={activeChatId} />
        </div>
      </div>
    </div>
  );
}
