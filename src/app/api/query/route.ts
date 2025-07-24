import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import { getFirebaseAuth } from '@/lib/firebase-admin-init';
import { Timestamp } from 'firebase-admin/firestore';
import { authenticateRequest } from '@/lib/api-auth';
import { findSimilarChunks } from '@/lib/embeddings';
import { rateLimit } from '@/lib/rate-limiter-memory';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for query API');
} catch (error) {
  console.error('❌ Firebase initialization failed in query API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}

// Azure OpenAI configuration
const azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';

export async function POST(request: NextRequest) {
  try {
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    
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
    
    // Ensure uploadData exists
    if (!uploadData) {
      return NextResponse.json({ message: 'Invalid file data' }, { status: 500 });
    }
    
    // Check file ownership (allow admin access too)
    if (uploadData.userId !== userId && userId !== process.env.ADMIN_USER_ID) {
      return NextResponse.json({ message: 'Not authorized to access this file' }, { status: 403 });
    }

    // Get the file metadata
    const metadata = uploadData.metadata || {};
    const { title, filename } = metadata;
    
    // Create a new query record
    const queryRef = db.collection('queries').doc();
    const queryId = queryRef.id;
    
    // Store the query details
    await queryRef.set({
      userId,
      fileId,
      prompt,
      status: 'processing',
      createdAt: Timestamp.now()
    });
    
    // Find similar chunks from the document
    console.log(`Finding similar chunks for query: ${prompt}`);
    const similarChunks = await findSimilarChunks(prompt, fileId);
    
    // Extract the content from chunks to use as context
    let context = '';
    if (similarChunks && similarChunks.length > 0) {
      similarChunks.forEach((chunk) => {
        context += chunk.content + '\n\n';
      });
    }
    
    // Create messages for Azure OpenAI
    const messages = [
      { role: "system", content: `You are a helpful assistant named Contexto. Your job is to provide accurate answers based on the context provided. If the answer is not in the context, say you don't have enough information. Be concise, accurate, and helpful. The current document you're analyzing is titled "${title || filename || 'Untitled'}"` },
      { role: "user", content: `Context information is below:\n\n${context}\n\nGiven the context information and not prior knowledge, answer the question: ${prompt}` },
      { role: "user", content: prompt } as const
    ];
    
    // Define deployment options to try - using exact deployment names from the Azure portal
    const deploymentOptions = [
      // These are the exact deployment names from your screenshot
      'gpt-35-turbo', // Note the hyphen format is correct from the screenshot
      'gpt-4',       // This is the correct format with hyphen
      'gpt-4o',      // This was also shown in your screenshot
      
      // Only try these if the above don't work
      process.env.AZURE_OPENAI_API_DEPLOYMENT,
      process.env.AZURE_OPENAI_DEPLOYMENT_GPT4,
      process.env.AZURE_OPENAI_DEPLOYMENT_TURBO
    ].filter(Boolean); // Remove undefined/null values
    
    console.log('Trying these chat deployments:', deploymentOptions);
    
    // Try to get a response from any available deployment
    const startTime = Date.now();
    let completionResponse: any = null;
    let deploymentUsed = '';
    let success = false;
    
    // Try each deployment until one works
    for (const deployment of deploymentOptions) {
      if (!deployment || typeof deployment !== 'string' || deployment.trim() === '') {
        continue;
      }
      
      console.log(`Trying Azure OpenAI with deployment: ${deployment}`);
      const baseUrl = azureEndpoint.replace(/\/$/, '');
      // Use a standard API version that works with most Azure OpenAI deployments
      const azurePath = `/openai/deployments/${deployment}/chat/completions?api-version=2023-05-15`;
      const requestUrl = `${baseUrl}${azurePath}`;
      console.log(`Request URL: ${requestUrl}`);
      
      try {
        // Log the request details (without sensitive info)
        console.log('Request headers:', {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': '[REDACTED]'
        });
        console.log('Request body structure:', {
          messages: '[MESSAGES ARRAY]',
          temperature: 0.7,
          max_tokens: 800
        });
        
        // Make the actual API call
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': azureApiKey,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
          })
        });
        
        if (response.ok) {
          completionResponse = await response.json();
          deploymentUsed = deployment;
          success = true;
          console.log(`Successful response from deployment: ${deployment}`);
          break;
        } else {
          if (response.status === 404) {
            console.log(`Deployment '${deployment}' not found (404).`);
          } else {
            const errorText = await response.text();
            console.log(`Error with deployment ${deployment}:`, errorText);
          }
        }
      } catch (error) {
        console.log(`Error with deployment ${deployment}:`, error);
      }
    }
    
    // No fallbacks - if all deployments failed, throw an error
    if (!success || !completionResponse) {
      console.error('All Azure OpenAI deployments failed');
      console.error('Deployments tried:', deploymentOptions);
      
      // Throw a clear error to ensure failures surface immediately
      throw new Error('Azure OpenAI query failed: All configured deployments failed to respond');
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
      deploymentUsed: deploymentUsed || 'unknown'
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
