import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { app } from '@/lib/firebase';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { findSimilarChunks } from '@/lib/embeddings';

// Initialize Firebase Admin services
const auth = getAuth(app);
const db = getFirestore(app);

// Azure OpenAI configuration
const azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
const completionDeployment = process.env.AZURE_COMPLETION_DEPLOYMENT || 'gpt-4';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized: Invalid user' }, { status: 401 });
    }

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

    // Get pipeline configuration
    const pipelineRef = db.collection('pipelines').doc(fileId);
    const pipelineDoc = await pipelineRef.get();
    
    if (!pipelineDoc.exists) {
      return NextResponse.json({ message: 'Pipeline not found' }, { status: 404 });
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
    if (!azureApiKey || !azureEndpoint) {
      throw new Error('Azure OpenAI credentials not configured');
    }
    
    const client = new OpenAIClient(
      azureEndpoint, 
      new AzureKeyCredential(azureApiKey)
    );
    
    // Create system prompt with context
    const systemPrompt = `You are an AI assistant helping with document question answering. 
    Answer the user's query based ONLY on the following context. 
    If you cannot find the answer in the context, say that you don't know rather than making up information.
    
    Context:
    ${context}`;
    
    // Generate completion
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ];

    const startTime = Date.now();
    const completionResponse = await client.getChatCompletions(completionDeployment, messages, {
      temperature: 0.7,
      maxTokens: 800,
    });
    const endTime = Date.now();
    
    // Get response
    const answer = completionResponse.choices[0].message?.content || "I couldn't generate a response.";
    
    // Calculate usage metrics
    const usageReport = {
      promptTokens: completionResponse.usage?.promptTokens || 0,
      completionTokens: completionResponse.usage?.completionTokens || 0,
      totalTokens: completionResponse.usage?.totalTokens || 0,
      latencyMs: endTime - startTime
    };
    
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
