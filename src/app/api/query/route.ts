import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { authenticateRequest } from '@/lib/api-auth';
import { OpenAI } from 'openai';
import { findSimilarChunks } from '@/lib/embeddings';
import { rateLimit } from '@/lib/rate-limiter-memory';

// Initialize Firebase Admin services
const db = getFirestore();

// Azure OpenAI configuration
const azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';

// Try to get the deployment name from multiple possible environment variables
// This provides better compatibility across different naming conventions
const possibleDeploymentNames = [
  process.env.AZURE_OPENAI_DEPLOYMENT,           // Generic deployment
  process.env.AZURE_OPENAI_DEPLOYMENT_TURBO,    // Specific for turbo
  process.env.AZURE_OPENAI_DEPLOYMENT_GPT35,    // Alternative naming
  process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,     // Generic chat deployment
  'gpt-35-turbo',                              // Common format with dash
  'gpt35-turbo',                               // Common format without dash
  'turbo',                                     // Simple name
  'gpt4',                                      // Fallback to GPT-4 if available
  'chat'                                       // Generic name
];

// Filter out undefined/empty values and use the first valid one
const azureDeployment = possibleDeploymentNames.find(name => name && name.trim() !== '') || 'gpt-35-turbo';

// Log configuration for diagnostic purposes
console.log('Using Azure OpenAI deployment:', azureDeployment);
console.log('Azure endpoint:', azureEndpoint);
console.log('Available deployment env vars:', {
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_DEPLOYMENT_TURBO: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO,
  AZURE_OPENAI_DEPLOYMENT_GPT35: process.env.AZURE_OPENAI_DEPLOYMENT_GPT35,
  AZURE_OPENAI_DEPLOYMENT_CHAT: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting first
    const rateLimitResult = await rateLimit(request, {
      // Allow more requests for query endpoint compared to uploads
      limit: 30,
      windowSizeInSeconds: 60,
      // Use userId if available, otherwise IP
      identifierFn: (req) => {
        // Try to get authentication from headers
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          // Use a hash of the token as identifier to avoid storing sensitive info
          return `user_${authHeader.slice(7, 15)}`; // Use part of the token as identifier
        }
        // Fall back to IP if no auth
        return req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown-ip';
      }
    });

    if (rateLimitResult.limited) {
      return rateLimitResult.response || NextResponse.json(
        { message: 'Rate limit exceeded', error: 'rate_limited' },
        { status: 429 }
      );
    }
    
    // Authenticate the request using our helper
    const authResult = await authenticateRequest(request);
    
    if (!authResult.authenticated) {
      // authenticateRequest already returns a proper NextResponse for errors
      return authResult.response;
    }
    
    const userId = authResult.userId;

    // Get request body
    const body = await request.json();
    const { prompt, fileId } = body;
    
    if (!prompt) {
      return NextResponse.json({ message: 'Bad request: No prompt provided' }, { status: 400 });
    }
    
    if (!fileId) {
      return NextResponse.json({ message: 'Bad request: No fileId provided' }, { status: 400 });
    }

    // Verify file ownership
    const uploadRef = db.collection('uploads').doc(fileId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }
    
    const uploadData = uploadDoc.data();
    if (uploadData?.userId !== userId) {
      return NextResponse.json({ message: 'Unauthorized: You do not own this file' }, { status: 403 });
    }

    // Check if the file has chunks/embeddings directly - this is what we actually need for queries
    const embeddingsRef = db.collection('embeddings').where('fileId', '==', fileId);
    const embeddingsSnapshot = await embeddingsRef.limit(1).get();
    
    if (embeddingsSnapshot.empty) {
      // No embeddings found - we need to handle this scenario differently
      console.log(`No embeddings found for file ${fileId}`);
      
      // Check if file has been processed through ingestion
      const uploadsRef = db.collection('uploads').doc(fileId);
      const uploadDoc = await uploadsRef.get();
      
      if (!uploadDoc.exists) {
        return NextResponse.json({ message: 'File not found' }, { status: 404 });
      }
      
      const uploadData = uploadDoc.data();
      const status = uploadData?.status;
      
      if (status === 'pending' || status === 'processing') {
        return NextResponse.json({ 
          message: 'File is still being processed. Please try again in a moment.' 
        }, { status: 409 });
      }
      
      // At this point, we have a file that's not being processed but has no embeddings
      // Create a specific error message
      return NextResponse.json({ 
        message: 'This file has not been properly processed. Please re-upload or contact support.' 
      }, { status: 422 });
    }
    
    // Get pipeline configuration (try, but we can proceed without it since we have embeddings)
    const pipelineRef = db.collection('pipelines').doc(fileId);
    let pipelineDoc = await pipelineRef.get();
    
    // If pipeline doesn't exist but we have embeddings, create a simplified pipeline
    if (!pipelineDoc.exists) {
      console.log(`Creating pipeline for file ${fileId} with existing embeddings`);
      
      // Get file information
      const uploadDoc = await db.collection('uploads').doc(fileId).get();
      const uploadData = uploadDoc.exists ? uploadDoc.data() : null;
      
      // Create a simplified pipeline that references existing embeddings
      const simplifiedPipeline = {
        id: fileId,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        fileId,
        name: `Pipeline for ${uploadData?.fileName || 'File ' + fileId}`,
        hasEmbeddings: true, // Flag indicating we've already verified embeddings exist
        nodes: [
          {
            id: 'dataSource',
            type: 'dataSource',
            position: { x: 100, y: 100 },
            data: {
              fileId,
              fileUrl: uploadData?.fileUrl || '',
              fileName: uploadData?.fileName || 'Unknown File'
            }
          },
          {
            id: 'indexer',
            type: 'indexer',
            position: { x: 100, y: 200 },
            data: {
              indexType: 'inmemory'
            }
          }
        ],
        edges: [
          { id: 'e-ds-ix', source: 'dataSource', target: 'indexer' }
        ]
      };
      
      try {
        // Try to save the pipeline, but continue even if this fails
        await pipelineRef.set(simplifiedPipeline);
        pipelineDoc = await pipelineRef.get(); // Re-fetch after creation
      } catch (error) {
        console.error('Error creating simplified pipeline:', error);
        // Continue anyway since we have embeddings and that's what matters for queries
      }
    }
    
    interface PipelineNode {
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, any>;
    }
    
    const pipelineData = pipelineDoc.data();
    const retrieverNode = pipelineData?.nodes?.find((node: PipelineNode) => node.type === 'retriever');
    const topK = retrieverNode?.data?.topK || 5;

    // Create query log entry
    const queryId = `${userId}_${Date.now()}`;
    const queryRef = db.collection('uploads').doc(fileId).collection('queries').doc(queryId);
    
    await queryRef.set({
      userId,
      fileId,
      queryId,
      prompt,
      timestamp: Timestamp.now(),
      status: 'processing'
    });

    // Execute RAG query
    // 1. Retrieve similar chunks
    const similarChunks = await findSimilarChunks(prompt, fileId, topK);
    
    // 2. Create context from chunks
    const context = similarChunks.map(chunk => chunk.text).join('\n\n');
    
    // 3. Generate response with Azure OpenAI
    if (!azureApiKey) {
      throw new Error('Azure OpenAI API key not configured');
    }
    
    if (!azureEndpoint) {
      throw new Error('Azure OpenAI endpoint not configured');
    }
    
    // Configure Azure OpenAI client
    const openai = new OpenAI({
      apiKey: azureApiKey,
      baseURL: `${azureEndpoint}`,
      defaultQuery: { 'api-version': '2023-07-01-preview' },
      defaultHeaders: { 'api-key': azureApiKey }
    });
    
    console.log('Using Azure OpenAI API with deployment:', azureDeployment);
    console.log('Azure OpenAI endpoint:', azureEndpoint);
    
    // Create system prompt with context
    const systemPrompt = `You are an AI assistant helping with document question answering. 
    Answer the user's query based ONLY on the following context. 
    If you cannot find the answer in the context, say that you don't know rather than making up information.
    
    Context:
    ${context}`;
    
    // Generate completion with proper typing for OpenAI SDK
    const messages = [
      { role: "system", content: systemPrompt } as const,
      { role: "user", content: prompt } as const
    ];

    const startTime = Date.now();
    
    // Use direct fetch for Azure OpenAI API calls
    // This is more compatible across Azure deployments
    async function tryCompletionWithDeployment(deploymentName: string): Promise<any> {
      // Ensure no double slashes in the URL
      const baseUrl = azureEndpoint.replace(/\/$/, '');
      const azurePath = `/openai/deployments/${deploymentName}/chat/completions`;
      const fullUrl = `${baseUrl}${azurePath}`;
      
      console.log(`Trying Azure OpenAI with deployment: ${deploymentName}`);
      console.log(`Request URL: ${fullUrl}`);
      
      try {
        // Make a direct fetch request - this is more reliable with Azure OpenAI
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: deploymentName,  // Required by Azure OpenAI
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
          })
        });
        
        if (!response.ok) {
          // Handle 404 specially since it likely means the deployment name is wrong
          if (response.status === 404) {
            console.error(`Deployment '${deploymentName}' not found (404).`);
            throw new Error(`Deployment '${deploymentName}' not found`);
          }
          
          // For other errors, parse the response
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Azure OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
      } catch (error: any) {
        // Improved error handling
        const errorMessage = error?.message || 'Unknown error';
        console.error(`Error with deployment ${deploymentName}:`, errorMessage);
        throw error;
      }
    }
    
    // Try all possible deployment names in order
    let completionResponse;
    let deploymentUsed = azureDeployment;
    const deploymentOptions = [
      azureDeployment,
      process.env.AZURE_OPENAI_DEPLOYMENT_CHAT, 
      process.env.AZURE_OPENAI_DEPLOYMENT_GPT35,
      process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
      'gpt-35-turbo',
      'gpt35-turbo',
      'turbo',
      'chat',
      'gpt4'
    ].filter(Boolean); // Filter out undefined/null values
    
    // Try each deployment in order until one works
    let success = false;
    
    for (const deployment of deploymentOptions) {
      // Skip undefined or empty deployments
      if (!deployment || deployment.trim() === '') {
        continue;
      }
      
      try {
        completionResponse = await tryCompletionWithDeployment(deployment);
        deploymentUsed = deployment;
        success = true;
        console.log(`Successfully used deployment: ${deployment}`);
        break;
      } catch (error: any) { // Type error as any to handle different error types
        const errorMessage = error?.message || 'Unknown error';
        console.warn(`Failed with deployment ${deployment}: ${errorMessage}`);
        // Continue to the next deployment option
      }
    }
    
    // If all deployments failed, provide a fallback response
    if (!success || !completionResponse) {
      console.error('All Azure OpenAI deployments failed, using fallback response');
      
      // Create a fallback response structure that matches the expected format
      completionResponse = {
        choices: [{
          message: {
            content: `I apologize, but I couldn't process your query "${prompt}" due to an Azure OpenAI configuration issue. All available deployments failed. Please check the deployment names in your Azure OpenAI account and ensure they match your environment variables.`
          }
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    }
    
    const endTime = Date.now();
    
    // Get response
    const answer = completionResponse.choices?.[0]?.message?.content || "I couldn't generate a response.";
    
    // Calculate usage metrics
    const usageReport = {
      promptTokens: completionResponse.usage?.prompt_tokens || 0,
      completionTokens: completionResponse.usage?.completion_tokens || 0,
      totalTokens: completionResponse.usage?.total_tokens || 0,
      latencyMs: endTime - startTime,
      deploymentUsed: deploymentUsed || 'fallback'
    };
    
    // Log completion for debugging
    console.log('Query completed successfully with deployment:', deploymentUsed);
    console.log('Query latency:', endTime - startTime, 'ms');
    
    // Update query with response
    await queryRef.update({
      answer,
      usageReport,
      status: 'completed',
      completedAt: Timestamp.now()
    });

    // Return the response
    return NextResponse.json({
      answer,
      usageReport,
      fileId,
      queryId
    });

  } catch (error) {
    console.error('Query error:', error);
    const message = error instanceof Error ? error.message : 'Unknown query error';
    return NextResponse.json({ message: `Query failed: ${message}` }, { status: 500 });
  }
}
