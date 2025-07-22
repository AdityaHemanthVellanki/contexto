'use client';

/**
 * Utility for Azure OpenAI API calls
 * Production implementation using Azure OpenAI APIs
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Environmental variables are used for Azure OpenAI credentials
const AZURE_OPENAI_API_KEY = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT_ID;

/**
 * Generate a pipeline from a natural language prompt using Azure OpenAI
 * @param prompt The user's natural language description of the pipeline
 * @returns A promise that resolves to a pipeline definition
 */
export async function generatePipelineFromPrompt(prompt: string): Promise<{
  nodes: any[];
  edges: any[];
  explanation: string;
}> {
  // Check if credentials are configured
  if (!AZURE_OPENAI_API_KEY || !AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_DEPLOYMENT_ID) {
    // In a production environment, we should handle this error properly
    // For now, we'll use the API endpoint to generate the pipeline
    return await callPipelineGenerationApi(prompt);
  }

  try {
    // Log usage for analytics
    await addDoc(collection(db, "usage"), {
      type: "pipeline_generation",
      timestamp: new Date(),
      prompt: prompt,
      model: AZURE_OPENAI_DEPLOYMENT_ID,
      success: true
    });

    // Call the server-side API to generate the pipeline
    return await callPipelineGenerationApi(prompt);
  } catch (error) {
    console.error("Error generating pipeline:", error);
    throw new Error(`Failed to generate pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call the server-side API to generate a pipeline
 * This abstracts the Azure OpenAI API call behind our own API endpoint
 */
async function callPipelineGenerationApi(prompt: string) {
  const response = await fetch('/api/generatePipeline', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Pipeline generation failed: ${response.status} ${response.statusText} ${errorData.error || ''}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Checks if API key is valid
 * In production this would verify with the actual API
 * @param apiKey The API key to check
 * @returns Whether the API key is valid
 */
export function isApiKeyValid(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simple validation: Check if key is not empty and at least 10 chars
      resolve(apiKey.length >= 10);
    }, 500);
  });
}
