'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SplitPane from 'react-split-pane';
import { useAuth } from '@/context/AuthContext';
import CanvasArea from '@/components/canvas/CanvasArea';
import RightPanel from '@/components/panels/RightPanel';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useChatStore } from '@/store/useChatStore';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { initializeCanvas } = useCanvasStore();
  const { setActiveTab } = useChatStore();

  // Initialize canvas when component loads
  useEffect(() => {
    if (user) {
      initializeCanvas();
    }
  }, [user, initializeCanvas]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authenticated, show the split-pane layout
  if (user) {
    return (
      <div className="h-[calc(100vh-64px)] flex">
        <SplitPane
          split="vertical"
          minSize={300}
          maxSize={-300}
          defaultSize="60%"
          className="h-full"
        >
          <div className="h-full">
            <CanvasArea />
          </div>
          <RightPanel />
        </SplitPane>
      </div>
    );
  }

  return null;
}
