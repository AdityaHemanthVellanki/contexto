import { z } from 'zod';

// Vector store interface
export interface VectorStore {
  name: string;
  upsert(documents: VectorDocument[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorQueryResult[]>;
}

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    text: string;
    fileId: string;
    fileName: string;
    chunkIndex: number;
  };
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    fileId: string;
    fileName: string;
    chunkIndex: number;
  };
}

// Firestore Vector Store (for small files < 5MB)
class FirestoreVectorStore implements VectorStore {
  name = 'firestore';

  async upsert(documents: VectorDocument[]): Promise<void> {
    const { getFirestoreAdmin } = await import('./firestore-admin');
    const db = await getFirestoreAdmin();
    
    const batch = db.batch();
    
    documents.forEach(doc => {
      const docRef = db.collection('vectors').doc(doc.id);
      batch.set(docRef, {
        id: doc.id,
        embedding: doc.values,
        metadata: doc.metadata,
        createdAt: new Date()
      });
    });
    
    await batch.commit();
    console.log(`Upserted ${documents.length} documents to Firestore`);
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    const { getFirestoreAdmin } = await import('./firestore-admin');
    const db = await getFirestoreAdmin();
    
    // Simple cosine similarity search (for production, use specialized vector DB)
    const vectorsSnapshot = await db.collection('vectors').limit(100).get();
    const results: Array<{ doc: Record<string, unknown>; score: number }> = [];
    
    vectorsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const score = cosineSimilarity(embedding, data.embedding as number[]);
      results.push({ doc: data as Record<string, unknown>, score });
    });
    
    // Sort by similarity score and return top K
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(result => ({
      id: result.doc.id as string,
      score: result.score,
      metadata: result.doc.metadata as VectorQueryResult['metadata']
    }));
  }
}

// Pinecone Vector Store (for large files > 100MB or production)
class PineconeVectorStore implements VectorStore {
  name = 'pinecone';
  private indexName: string;

  constructor(indexName: string = 'contexto-index') {
    this.indexName = indexName;
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('Pinecone API key not configured');
    }

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });
      
      const index = pinecone.index(this.indexName);
      
      const vectors = documents.map(doc => ({
        id: doc.id,
        values: doc.values,
        metadata: doc.metadata
      }));
      
      await index.upsert(vectors);
      console.log(`Upserted ${documents.length} documents to Pinecone`);
    } catch (error) {
      console.error('Pinecone upsert error:', error);
      throw new Error(`Failed to upsert to Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('Pinecone API key not configured');
    }

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });
      
      const index = pinecone.index(this.indexName);
      
      const queryResponse = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true
      });
      
      return queryResponse.matches?.map((match: { id: string; score?: number; metadata?: Record<string, unknown> }) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as VectorQueryResult['metadata']
      })) || [];
    } catch (error) {
      console.error('Pinecone query error:', error);
      throw new Error(`Failed to query Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Qdrant Vector Store (for critical/production workloads)
class QdrantVectorStore implements VectorStore {
  name = 'qdrant';
  private collectionName: string;

  constructor(collectionName: string = 'contexto') {
    this.collectionName = collectionName;
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!process.env.QDRANT_URL) {
      throw new Error('Qdrant URL not configured');
    }

    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY
      });
      
      const points = documents.map(doc => ({
        id: doc.id,
        vector: doc.values,
        payload: doc.metadata
      }));
      
      await client.upsertPoints(this.collectionName, {
        points,
        wait: true
      });
      console.log(`Upserted ${documents.length} documents to Qdrant`);
    } catch (error) {
      console.error('Qdrant upsert error:', error);
      throw new Error(`Failed to upsert to Qdrant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    if (!process.env.QDRANT_URL) {
      throw new Error('Qdrant URL not configured');
    }

    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY
      });
      
      const results = await client.searchPoints(this.collectionName, {
        vector: embedding,
        limit: topK,
        withPayload: true
      });
      
      return results.points.map((result: { id: string; score: number; payload?: Record<string, unknown> }) => ({
        id: result.id,
        score: result.score,
        metadata: result.payload as VectorQueryResult['metadata']
      }));
    } catch (error) {
      console.error('Qdrant query error:', error);
      throw new Error(`Failed to query Qdrant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Supabase Vector Store (for medium files 5-100MB)
class SupabaseVectorStore implements VectorStore {
  name = 'supabase';

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration not found');
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const rows = documents.map(doc => ({
        id: doc.id,
        embedding: doc.values,
        metadata: doc.metadata,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('vectors')
        .upsert(rows);

      if (error) throw error;
      console.log(`Upserted ${documents.length} documents to Supabase`);
    } catch (error) {
      console.error('Supabase upsert error:', error);
      throw new Error(`Failed to upsert to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration not found');
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Use Supabase's vector similarity search
      const { data, error } = await supabase.rpc('match_vectors', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: topK
      });

      if (error) throw error;

      return data?.map((result: { id: string; similarity: number; metadata: Record<string, unknown> }) => ({
        id: result.id,
        score: result.similarity,
        metadata: result.metadata as VectorQueryResult['metadata']
      })) || [];
    } catch (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Failed to query Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Vector store selection logic
export async function getVectorStore(fileSizeBytes: number, purpose: string): Promise<VectorStore> {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  
  // Decision logic based on file size and purpose
  if (fileSizeMB < 5 && purpose.toLowerCase().includes('prototype')) {
    return new FirestoreVectorStore();
  }
  
  if (fileSizeMB < 100) {
    // Try Supabase first, fallback to Firestore
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new SupabaseVectorStore();
    }
    return new FirestoreVectorStore();
  }
  
  if (purpose.toLowerCase().includes('critical') || purpose.toLowerCase().includes('production')) {
    // Try Qdrant first for critical workloads
    if (process.env.QDRANT_URL && process.env.QDRANT_API_KEY) {
      return new QdrantVectorStore();
    }
  }
  
  // Default to Pinecone for large files
  if (process.env.PINECONE_API_KEY) {
    return new PineconeVectorStore();
  }
  
  // Fallback to Firestore (with warning)
  console.warn(`Large file (${fileSizeMB.toFixed(1)}MB) using Firestore - consider configuring Pinecone or Qdrant`);
  return new FirestoreVectorStore();
}

// Utility function for cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
