import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create MCP Server | Contexto',
  description: 'Create a new Model Context Protocol server with document upload and AI-powered search',
};

export default function MCPCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
