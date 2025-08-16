import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getServerEnv } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limiter-memory';
import { getVectorStore } from '@/lib/vectorStore';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { prompt } = await request.json();
    
    const auth = await verifyAuth(request);
    if (!auth.success || !auth.userId) {
      return NextResponse.json(
        { error: 'You must be signed in to perform this action' },
        { status: 401 }
      );
    }

    const identifier = `api:query:${auth.userId}`;
    const { limited, headers } = await rateLimit(identifier, { limit: 60, windowSizeInSeconds: 60 });
    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers }
      );
    }

    const vectorStore = await getVectorStore();
    const results = await vectorStore.similaritySearch(prompt, 5);
    const context = results.map((r: any) => r.pageContent).join('\n\n');

    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `You are a helpful assistant. Use the following context to answer the user's question:\n\n${context}` },
        { role: 'user', content: prompt }
      ],
    });
    const response = completion.choices[0].message?.content || '';

    const adminDb = initializeFirebaseAdmin();
    await adminDb.collection('conversations').add({
      userId: auth.userId,
      prompt,
      response,
      createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}