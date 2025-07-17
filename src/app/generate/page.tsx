import { Metadata } from 'next';
import { PipelineGeneratorPage } from '@/components/pipeline/PipelineGeneratorPage';

export const metadata: Metadata = {
  title: 'Generate MCP Pipeline | Contexto',
  description: 'Generate MCP pipelines using natural language with AI-powered automation',
  keywords: ['MCP', 'pipeline', 'generation', 'AI', 'automation', 'natural language'],
};

export default function GeneratePage() {
  return <PipelineGeneratorPage />;
}
