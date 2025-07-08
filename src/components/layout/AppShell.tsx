'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the TopNav to avoid SSR issues with auth
const TopNav = dynamic(() => import('@/components/navigation/TopNav'), {
  ssr: false
});

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <>
      <TopNav />
      <main className="min-h-screen">
        {children}
      </main>
    </>
  );
}
