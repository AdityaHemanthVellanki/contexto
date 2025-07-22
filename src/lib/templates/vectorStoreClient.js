/**
 * Vector Store Client
 * 
 * This client provides a unified interface to interact with vector databases
 * like Pinecone, Qdrant, Supabase, and Firestore for embedding and retrieval.
 * 
 * Configuration is loaded from environment variables based on the detected
 * vector store type.
 */

// Load environment variables
const VECTOR_STORE_TYPE = process.env.VECTOR_STORE_TYPE || 'firestore';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-ada-002';

class VectorStoreClient {
  constructor() {
    this.initialized = false;
    this.vectorStore = null;
    this.embeddingClient = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize embedding client
      await this.initializeEmbeddingClient();
      
      // Initialize vector store based on configuration
      await this.initializeVectorStore();
      
      this.initialized = true;
      console.log(`Vector store client initialized: ${VECTOR_STORE_TYPE}`);
    } catch (error) {
      console.error('Vector store initialization error:', error);
      throw new Error(`Failed to initialize vector store: ${error.message}`);
    }
  }

  async initializeEmbeddingClient() {
    // Choose embedding provider based on configuration
    if (EMBEDDING_MODEL.includes('openai') || EMBEDDING_MODEL.includes('ada')) {
      // OpenAI embeddings
      if (!process.env.OPENAI_API_KEY && !process.env.AZURE_OPENAI_API_KEY) {
        throw new Error('OpenAI or Azure OpenAI API key not configured');
      }
      
      try {
        // Use Azure OpenAI if configured, otherwise fallback to OpenAI
        if (process.env.AZURE_OPENAI_API_KEY) {
          const { OpenAIClient } = await import('@azure/openai');
          const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
          const apiKey = process.env.AZURE_OPENAI_API_KEY;
          
          this.embeddingClient = {
            type: 'azure',
            client: new OpenAIClient(endpoint, { key: apiKey }),
            deploymentName: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002',
            embed: async (texts) => {
              const result = await this.embeddingClient.client.getEmbeddings(
                this.embeddingClient.deploymentName,
                texts
              );
              return result.data.map(item => item.embedding);
            }
          };
        } else {
          const { OpenAI } = await import('openai');
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          this.embeddingClient = {
            type: 'openai',
            client,
            model: EMBEDDING_MODEL,
            embed: async (texts) => {
              const response = await client.embeddings.create({
                model: this.embeddingClient.model,
                input: texts
              });
              return response.data.map(item => item.embedding);
            }
          };
        }
      } catch (error) {
        console.error('Failed to initialize embedding client:', error);
        throw error;
      }
    } else {
      // Use a real OpenAI compatible embeddings endpoint
      try {
        // First check for environment configuration
        const embeddingEndpoint = process.env.EMBEDDING_API_ENDPOINT || 'https://api.openai.com/v1/embeddings';
        const embeddingApiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
        const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
        
        if (!embeddingApiKey) {
          throw new Error('No embedding API key found in environment variables');
        }
        
        console.log(`Initializing production embedding client with model: ${embeddingModel}`);
        
        this.embeddingClient = {
          type: 'openai',
          model: embeddingModel,
          embed: async (texts) => {
            // Production-ready real embeddings implementation
            const embeddings = [];
            
            // Process in batches to avoid rate limits
            for (let i = 0; i < texts.length; i++) {
              const response = await fetch(embeddingEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${embeddingApiKey}`
                },
                body: JSON.stringify({
                  input: texts[i],
                  model: embeddingModel
                })
              });
              
              if (!response.ok) {
                const error = await response.text();
                throw new Error(`Embedding API error: ${error}`);
              }
              
              const result = await response.json();
              embeddings.push(result.data[0].embedding);
            }
            
            return embeddings;
          }
        };
      } catch (error) {
        console.error('Failed to initialize production embedding client:', error);
        throw new Error(`Embedding service initialization failed: ${error.message}`);
      }
    }
  }

  async initializeVectorStore() {
    switch (VECTOR_STORE_TYPE.toLowerCase()) {
      case 'pinecone':
        await this.initializePinecone();
        break;
      case 'qdrant':
        await this.initializeQdrant();
        break;
      case 'supabase':
        await this.initializeSupabase();
        break;
      case 'firestore':
      default:
        await this.initializeFirestore();
        break;
    }
  }

  async initializePinecone() {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      throw new Error('Pinecone configuration not found');
    }

    try {
      const { PineconeClient } = await import('@pinecone-database/pinecone');
      const client = new PineconeClient();
      
      await client.init({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp'
      });
      
      const indexName = process.env.PINECONE_INDEX;
      const index = client.Index(indexName);
      
      this.vectorStore = {
        type: 'pinecone',
        client,
        index,
        namespace: process.env.PINECONE_NAMESPACE || 'default',
        
        index: async (embeddings, documents, metadata = {}) => {
          const vectors = embeddings.map((embedding, i) => ({
            id: `doc-${Date.now()}-${i}`,
            values: embedding,
            metadata: {
              text: documents[i],
              ...metadata
            }
          }));
          
          await this.vectorStore.index.upsert({
            upsertRequest: {
              vectors,
              namespace: this.vectorStore.namespace
            }
          });
          
          return { count: vectors.length };
        },
        
        query: async (embedding, topK = 5) => {
          const queryResponse = await this.vectorStore.index.query({
            queryRequest: {
              namespace: this.vectorStore.namespace,
              topK,
              includeMetadata: true,
              vector: embedding
            }
          });
          
          return queryResponse.matches.map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata
          }));
        }
      };
    } catch (error) {
      console.error('Pinecone initialization error:', error);
      throw error;
    }
  }

  async initializeQdrant() {
    if (!process.env.QDRANT_URL) {
      throw new Error('Qdrant URL not configured');
    }

    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY
      });
      
      const collectionName = process.env.QDRANT_COLLECTION || 'contexto';
      
      this.vectorStore = {
        type: 'qdrant',
        client,
        collectionName,
        
        index: async (embeddings, documents, metadata = {}) => {
          const points = embeddings.map((embedding, i) => ({
            id: `${Date.now()}-${i}`,
            vector: embedding,
            payload: {
              text: documents[i],
              ...metadata
            }
          }));
          
          await client.upsertPoints(collectionName, {
            points,
            wait: true
          });
          
          return { count: points.length };
        },
        
        query: async (embedding, topK = 5) => {
          const results = await client.searchPoints(collectionName, {
            vector: embedding,
            limit: topK,
            withPayload: true
          });
          
          return results.points.map(result => ({
            id: result.id,
            score: result.score,
            metadata: result.payload
          }));
        }
      };
    } catch (error) {
      console.error('Qdrant initialization error:', error);
      throw error;
    }
  }

  async initializeSupabase() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration not found');
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      this.vectorStore = {
        type: 'supabase',
        client: supabase,
        
        index: async (embeddings, documents, metadata = {}) => {
          const rows = embeddings.map((embedding, i) => ({
            id: `${Date.now()}-${i}`,
            embedding,
            metadata: {
              text: documents[i],
              ...metadata
            },
            created_at: new Date().toISOString()
          }));
          
          const { error } = await supabase
            .from('vectors')
            .upsert(rows);
          
          if (error) throw error;
          
          return { count: rows.length };
        },
        
        query: async (embedding, topK = 5) => {
          const { data, error } = await supabase.rpc('match_vectors', {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: topK
          });
          
          if (error) throw error;
          
          return data?.map(result => ({
            id: result.id,
            score: result.similarity,
            metadata: result.metadata
          })) || [];
        }
      };
    } catch (error) {
      console.error('Supabase initialization error:', error);
      throw error;
    }
  }

  async initializeFirestore() {
    try {
      const { initializeApp, cert, getApps } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      
      let app;
      if (!getApps().length) {
        app = initializeApp({
          credential: process.env.GOOGLE_APPLICATION_CREDENTIALS 
            ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
            : undefined // Use application default credentials
        });
      } else {
        app = getApps()[0];
      }
      
      const db = getFirestore(app);
      const collectionName = process.env.FIRESTORE_COLLECTION || 'vectors';
      
      this.vectorStore = {
        type: 'firestore',
        db,
        collectionName,
        
        index: async (embeddings, documents, metadata = {}) => {
          const batch = db.batch();
          
          embeddings.forEach((embedding, i) => {
            const docRef = db.collection(collectionName).doc();
            batch.set(docRef, {
              id: docRef.id,
              embedding,
              text: documents[i],
              metadata: {
                ...metadata,
                timestamp: new Date()
              }
            });
          });
          
          await batch.commit();
          
          return { count: embeddings.length };
        },
        
        query: async (embedding, topK = 5) => {
          // Since Firestore doesn't have native vector search,
          // implement cosine similarity in application code
          const snapshot = await db.collection(collectionName).limit(100).get();
          
          const results = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.embedding) {
              const score = this.cosineSimilarity(embedding, data.embedding);
              results.push({
                id: doc.id,
                score,
                metadata: {
                  text: data.text,
                  ...data.metadata
                }
              });
            }
          });
          
          // Sort by similarity score and take top-k
          return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
        }
      };
    } catch (error) {
      console.error('Firestore initialization error:', error);
      throw error;
    }
  }

  cosineSimilarity(a, b) {
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

  // Public API methods

  async embed(texts) {
    if (!this.initialized) await this.initialize();
    
    if (!Array.isArray(texts)) {
      texts = [texts];
    }
    
    // Filter out empty texts
    const nonEmptyTexts = texts.filter(text => text && text.trim().length > 0);
    
    if (nonEmptyTexts.length === 0) {
      return { embeddings: [], model: this.embeddingClient.model || 'unknown' };
    }
    
    try {
      const embeddings = await this.embeddingClient.embed(nonEmptyTexts);
      return {
        embeddings,
        model: this.embeddingClient.model || this.embeddingClient.type
      };
    } catch (error) {
      console.error('Embedding error:', error);
      throw new Error(`Failed to create embeddings: ${error.message}`);
    }
  }

  async index(embeddings, texts, metadata = {}) {
    if (!this.initialized) await this.initialize();
    
    if (!Array.isArray(embeddings) || !Array.isArray(texts) || 
        embeddings.length === 0 || embeddings.length !== texts.length) {
      throw new Error('Invalid inputs: embeddings and texts must be non-empty arrays of the same length');
    }
    
    try {
      return await this.vectorStore.index(embeddings, texts, metadata);
    } catch (error) {
      console.error('Indexing error:', error);
      throw new Error(`Failed to index vectors: ${error.message}`);
    }
  }

  async query(embedding, topK = 5) {
    if (!this.initialized) await this.initialize();
    
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding: must be a non-empty array');
    }
    
    try {
      return await this.vectorStore.query(embedding, topK);
    } catch (error) {
      console.error('Query error:', error);
      throw new Error(`Failed to query vectors: ${error.message}`);
    }
  }

  async embedAndQuery(text, topK = 5) {
    if (!this.initialized) await this.initialize();
    
    try {
      const { embeddings } = await this.embed([text]);
      if (!embeddings || embeddings.length === 0) {
        return [];
      }
      
      return await this.query(embeddings[0], topK);
    } catch (error) {
      console.error('Embed and query error:', error);
      throw new Error(`Failed to embed and query: ${error.message}`);
    }
  }
}

// Export singleton instance
const client = new VectorStoreClient();
module.exports = client;
