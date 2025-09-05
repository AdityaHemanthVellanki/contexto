import { NextResponse } from 'next/server';
import { z } from 'zod';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';

// Initialize Firebase Admin SDK at module load time
// This ensures Firebase is ready before any requests are processed
try {
  // This will initialize Firebase Admin if not already initialized
  initializeFirebaseAdmin();
  console.log('✅ Firebase initialized successfully for deployVectorStore API');
} catch (error) {
  console.error('❌ Firebase initialization failed in deployVectorStore API:', 
    error instanceof Error ? error.message : String(error));
  // The error will be handled when the API route is called - no fallbacks
}
import { authenticateRequest } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limiter-memory';

// Request schema validation
const DeployVectorStoreSchema = z.object({
  fileId: z.string().min(1),
  pipelineId: z.string().min(1)
});

// Vector store factory function
function getVectorStore(sizeBytes: number, purpose: string): { type: string; priority: number } {
  // Intelligent vector store selection based on file size and purpose
  if (sizeBytes > 50 * 1024 * 1024) { // > 50MB
    return { type: 'pinecone', priority: 1 }; // Best for large datasets
  } else if (purpose.toLowerCase().includes('real-time') || purpose.toLowerCase().includes('chat')) {
    return { type: 'qdrant', priority: 2 }; // Best for real-time applications
  } else if (purpose.toLowerCase().includes('analytics') || purpose.toLowerCase().includes('search')) {
    return { type: 'supabase', priority: 3 }; // Good for analytics workloads
  } else {
    return { type: 'firestore', priority: 4 }; // Good for simple use cases and small datasets
  }
}

// Configuration helpers
async function getQdrantConfig(): Promise<{ url: string; apiKey?: string }> {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url) {
    throw new Error('Qdrant URL not configured');
  }
  return { url, apiKey };
}

async function getSupabaseConfig(): Promise<{ url: string; serviceKey: string }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase configuration not set (SUPABASE_URL, SUPABASE_SERVICE_KEY)');
  }
  return { url, serviceKey };
}

// Pinecone index creation
async function createPineconeIndex(pipelineId: string): Promise<string> {
  const apiKey = process.env.PINECONE_API_KEY;
  const environment = process.env.PINECONE_ENVIRONMENT || 'us-east1-gcp';
  
  if (!apiKey) {
    throw new Error('Pinecone API key not configured');
  }

  const indexName = `contexto-${pipelineId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  try {
    // Check if index already exists
    const listResponse = await fetch(`https://api.pinecone.io/indexes`, {
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (listResponse.ok) {
      const indexes = await listResponse.json();
      const existingIndex = indexes.indexes?.find((idx: any) => idx.name === indexName);
      if (existingIndex) {
        return `https://${indexName}-${environment}.svc.${environment}.pinecone.io`;
      }
    }

    // Create new index
    const createResponse = await fetch(`https://api.pinecone.io/indexes`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: indexName,
        dimension: 1536, // OpenAI embedding dimension
        metric: 'cosine',
        pods: 1,
        replicas: 1,
        pod_type: 'p1.x1'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Pinecone index creation failed: ${error}`);
    }

    return `https://${indexName}-${environment}.svc.${environment}.pinecone.io`;
  } catch (error) {
    console.error('Pinecone deployment error:', error);
    throw error;
  }
}

// Qdrant collection creation
async function createQdrantCollection(pipelineId: string): Promise<string> {
  const { apiKey, url } = await getQdrantConfig();
  const collectionName = `contexto-${pipelineId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    // Use Qdrant REST API to create a collection
    const createResponse = await fetch(`${url}/collections/${collectionName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        vectors: {
          size: 1536, // OpenAI embedding dimension
          distance: 'Cosine',
        },
      }),
    });

    if (!createResponse.ok && createResponse.status !== 409) { // 409 = already exists
      const errorText = await createResponse.text();
      throw new Error(`Qdrant collection creation failed: ${errorText}`);
    }

    return `${url}/collections/${collectionName}`;
  } catch (error) {
    console.error('Qdrant deployment error:', error);
    throw error;
  }
}

// Supabase table creation
async function createSupabaseTable(pipelineId: string): Promise<string> {
  const { url, serviceKey } = await getSupabaseConfig();
  
  const tableName = `contexto_${pipelineId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  
  try {
    // Create table using Supabase REST API
    const createResponse = await fetch(`${url}/rest/v1/rpc/create_vector_table`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        table_name: tableName,
        dimension: 1536
      })
    });

    if (!createResponse.ok && createResponse.status !== 409) { // 409 = already exists
      const error = await createResponse.text();
      throw new Error(`Supabase table creation failed: ${error}`);
    }

    return `${url}/rest/v1/${tableName}`;
  } catch (error) {
    console.error('Supabase deployment error:', error);
    throw error;
  }
}

// Firestore collection creation
async function createFirestoreCollection(pipelineId: string): Promise<string> {
  try {
    // Get Firestore instance using our improved initialization approach
    const db = initializeFirebaseAdmin();
    
    // Collection path for this pipeline's vectors
    const collectionPath = `embeddings/${pipelineId}/chunks`;
    
    // No need to explicitly create the collection in Firestore
    // Collections are created automatically when documents are added
    // Just verify we can access Firestore
    
    // Add a metadata document to mark this collection as created
    await db.collection('embeddings').doc(pipelineId).set({
      createdAt: new Date(),
      status: 'provisioned',
      type: 'firestore',
      dimension: 1536
    }, { merge: true });
    
    console.log(`Firestore vector store provisioned for pipeline ${pipelineId}`);
    
    // Return the collection path as the endpoint
    return collectionPath;
  } catch (error) {
    console.error('Firestore vector store provisioning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to provision Firestore vector store: ${errorMessage}`);
  }
}

export async function POST(request: Request) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      windowSizeInSeconds: 300 // 5 requests per 5 minutes
    });

    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: 'Too many deployment requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // Authenticate request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response || NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const userId = authResult.userId!;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = DeployVectorStoreSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const { fileId, pipelineId } = validationResult.data;

    // Initialize Firestore using our improved initialization approach
    const db = initializeFirebaseAdmin();

    // Load file metadata
    const uploadDoc = await db.collection('uploads').doc(fileId).get();
    if (!uploadDoc.exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const uploadData = uploadDoc.data()!;
    if (uploadData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to file' }, { status: 403 });
    }

    // Load pipeline metadata
    const pipelineDoc = await db.collection('pipelines').doc(pipelineId).get();
    if (!pipelineDoc.exists) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const pipelineData = pipelineDoc.data()!;
    if (pipelineData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to pipeline' }, { status: 403 });
    }

    // Determine optimal vector store
    const vectorStoreConfig = getVectorStore(uploadData.fileSize || 0, uploadData.purpose || '');
    console.log(`Selected vector store: ${vectorStoreConfig.type} for pipeline ${pipelineId}`);

    let vectorStoreEndpoint: string;
    const storeType: string = vectorStoreConfig.type;

    // Provision vector store based on type
    try {
      switch (vectorStoreConfig.type) {
        case 'pinecone':
          vectorStoreEndpoint = await createPineconeIndex(pipelineId);
          break;
        case 'qdrant':
          vectorStoreEndpoint = await createQdrantCollection(pipelineId);
          break;
        case 'supabase':
          vectorStoreEndpoint = await createSupabaseTable(pipelineId);
          break;
        case 'firestore':
          vectorStoreEndpoint = await createFirestoreCollection(pipelineId);
          break;
        default:
          // No fallbacks - throw error for unknown vector store type
          throw new Error(`Unsupported vector store type: ${vectorStoreConfig.type}. Configure a supported vector store.`);
      }
    } catch (error) {
      console.error(`Vector store deployment failed for ${vectorStoreConfig.type}:`, error);
      
      // No fallbacks - propagate the error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Vector store deployment failed: ${errorMessage}. Ensure proper configuration for ${vectorStoreConfig.type}.`);
    }

    // Save deployment metadata
    await db.collection('deployments').doc(`${userId}_${pipelineId}_vectorstore`).set({
      userId,
      pipelineId,
      fileId,
      type: 'vectorstore',
      storeType,
      endpoint: vectorStoreEndpoint,
      status: 'deployed',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Log deployment
    await db.collection('usage').add({
      userId,
      action: 'vector_store_deployed',
      pipelineId,
      storeType,
      endpoint: vectorStoreEndpoint,
      timestamp: new Date()
    });

    return NextResponse.json({
      vectorStoreEndpoint,
      storeType,
      message: `Vector store deployed successfully using ${storeType}`
    }, { 
      status: 200,
      headers: rateLimitResult.headers 
    });

  } catch (error) {
    console.error('Vector store deployment error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown deployment error'
    }, { status: 500 });
  }
}
