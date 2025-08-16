import { Pinecone } from '@pinecone-database/pinecone';

// Import types directly from Pinecone SDK
type RecordMetadata = Record<string, any>;
type RecordId = string;
type RecordValues = number[];

// Define interfaces based on Pinecone SDK v6.1.2
interface PineconeRecord {
  id: RecordId;
  values: RecordValues;
  metadata?: RecordMetadata;
}

interface ScoredPineconeRecord extends PineconeRecord {
  score: number;
}

interface QueryOptions {
  vector: RecordValues;
  topK: number;
  includeMetadata?: boolean;
  includeValues?: boolean;
  namespace?: string;
  filter?: Record<string, any>;
}

interface QueryResponse {
  matches: ScoredPineconeRecord[];
  namespace?: string;
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

/**
 * List all indexes
 */
export async function listIndexes(): Promise<string[]> {
  try {
    // @ts-ignore - Pinecone SDK types don't properly expose this method
    const response = await pinecone.listIndexes();
    return response.indexes?.map((index: { name: string }) => index.name) || [];
  } catch (error) {
    console.error('Error listing Pinecone indexes:', error);
    return [];
  }
}

/**
 * Create index if it doesn't exist
 */
export async function ensureIndex(indexName: string): Promise<void> {
  try {
    // Check if index exists first
    const indexes = await listIndexes();
    if (indexes.includes(indexName)) {
      console.log(`Pinecone index already exists: ${indexName}`);
      return;
    }
    
    // Create index if it doesn't exist
    // @ts-ignore - Pinecone SDK v6.1.2 has createIndex method but TypeScript doesn't recognize it
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // Azure OpenAI embedding dimension
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      },
      suppressConflicts: true // Don't error if index already exists
    });
    console.log(`Created Pinecone index: ${indexName}`);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log(`Pinecone index already exists: ${indexName}`);
    } else {
      throw error;
    }
  }
}

/**
 * Wait for a Pinecone index to become ready.
 * Polls describeIndex until status.ready is true (or state === 'Ready').
 */
export async function waitForIndexReady(
  indexName: string,
  timeoutMs: number = 180_000,
  pollIntervalMs: number = 5_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // @ts-ignore - Pinecone SDK method is available at runtime
      const desc = await pinecone.describeIndex(indexName);
      const ready = Boolean(desc?.status?.ready);
      const state = desc?.status?.state as string | undefined;
      if (ready || state === 'Ready') {
        return;
      }
    } catch (err: any) {
      // If not found yet, continue polling. Log and continue on transient errors.
      const msg = err?.message || '';
      if (err?.name === 'PineconeNotFoundError' || err?.status === 404 || msg.includes('404')) {
        // keep waiting
      } else {
        console.warn('Pinecone describeIndex transient error:', err);
      }
    }
    await new Promise((res) => setTimeout(res, pollIntervalMs));
  }
  throw new Error(`Pinecone index ${indexName} not ready within ${timeoutMs}ms`);
}

/**
 * Ensure an index exists and is ready for traffic.
 */
export async function ensureIndexAndWait(
  indexName: string,
  timeoutMs?: number,
  pollIntervalMs?: number
): Promise<void> {
  await ensureIndex(indexName);
  await waitForIndexReady(indexName, timeoutMs ?? 180_000, pollIntervalMs ?? 5_000);
}

/**
 * Get or create a Pinecone index for a user's pipeline
 */
export async function getOrCreateIndex(userId: string, pipelineId: string): Promise<string> {
  // Pinecone index name must be <= 45 chars, lowercase, a-z0-9- only
  // Build a compact, stable name from truncated sanitized IDs
  const userPart = userId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const pipePart = pipelineId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const indexName = `ctx-${userPart}-${pipePart}`;
  
  try {
    // Check if index exists
    const existingIndex = (await listIndexes()).find(index => index === indexName);
    
    if (!existingIndex) {
      await ensureIndexAndWait(indexName);
    } else {
      // Ensure the existing index is ready before returning
      await waitForIndexReady(indexName);
    }
    
    return indexName;
  } catch (error) {
    console.error('Error getting or creating Pinecone index:', error);
    throw new Error(`Failed to get or create index for user ${userId} and pipeline ${pipelineId}`);
  }
}

/**
 * Upsert embeddings to Pinecone
 */
export async function upsertEmbeddings(
  indexName: string,
  records: PineconeRecord[],
  namespace = ''
): Promise<void> {
  try {
    const index = pinecone.index(indexName);
    
    // Batch upserts in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      // Add namespace to the records if provided
      if (namespace) {
        // @ts-ignore - Pinecone SDK v6.1.2 has namespace method but TypeScript doesn't recognize it
        await index.namespace(namespace).upsert(batch);
      } else {
        // @ts-ignore - TypeScript doesn't recognize the correct types for upsert
        await index.upsert(batch);
      }
    }
    
    console.log(`Upserted ${records.length} embeddings to Pinecone index: ${indexName}`);
  } catch (error) {
    console.error('Pinecone upsert error:', error);
    throw new Error('Failed to upsert embeddings');
  }
}

/**
 * Query embeddings from Pinecone
 */
export async function queryEmbeddings(
  indexName: string,
  queryVector: number[],
  topK = 5,
  namespace = '',
  includeMetadata = true
): Promise<ScoredPineconeRecord[]> {
  try {
    const index = pinecone.index(indexName);
    
    // Use namespace if provided
    const queryOptions: QueryOptions = {
      vector: queryVector,
      topK,
      includeMetadata
    };
    
    let queryResponse;
    if (namespace) {
      // @ts-ignore - Pinecone SDK v6.1.2 has namespace method but TypeScript doesn't recognize it
      queryResponse = await index.namespace(namespace).query(queryOptions);
    } else {
      // @ts-ignore - TypeScript doesn't recognize the correct types for query
      queryResponse = await index.query(queryOptions);
    }
    
    return queryResponse.matches || [];
  } catch (error) {
    console.error('Pinecone query error:', error);
    throw new Error('Failed to query embeddings');
  }
}

/**
 * Delete index
 */
export async function deleteIndex(indexName: string): Promise<void> {
  try {
    console.log(`Deleting index: ${indexName}`);
    // @ts-ignore - Pinecone SDK v6 typing issue
    await pinecone.deleteIndex(indexName);
    console.log(`Index ${indexName} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting index ${indexName}:`, error);
    throw new Error(`Failed to delete index ${indexName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Delete embeddings by document ID
export async function deleteEmbeddings(docId: string, indexName: string, namespace = ''): Promise<void> {
  try {
    console.log(`Deleting embeddings for document ${docId} from index ${indexName}${namespace ? ` namespace ${namespace}` : ''}`);
    
    const index = pinecone.index(indexName);
    
    // Delete vectors by filter on docId metadata field
    // @ts-ignore - Pinecone SDK v6 typing issue
    await index.deleteMany({
      filter: { docId },
      namespace
    });
    
    console.log(`Embeddings for document ${docId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting embeddings for document ${docId}:`, error);
    throw new Error(`Failed to delete embeddings for document ${docId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
