/**
 * Vector Store Client for MCP Server
 * Provides a consistent interface to different vector store implementations
 */

/**
 * Initialize the appropriate vector store client based on type and config
 * @param {Object} options
 * @param {string} options.type - Vector store type: 'pinecone', 'qdrant', 'supabase', or 'firestore'
 * @param {Object} options.config - Configuration object for the vector store
 * @returns {Object} - Vector store client with upsert, query, and deleteIndex methods
 */
export function initVectorStoreClient({ type, config }) {
  if (!type || !config) {
    throw new Error('Vector store type and configuration are required');
  }

  console.log(`Initializing vector store client of type: ${type}`);

  // Switch based on vector store type
  switch (type.toLowerCase()) {
    case 'pinecone':
      return initPineconeClient(config);
    case 'qdrant':
      return initQdrantClient(config);
    case 'supabase':
      return initSupabaseClient(config);
    case 'firestore':
      return initFirestoreClient(config);
    default:
      throw new Error(`Unsupported vector store type: ${type}`);
  }
}

/**
 * Initialize a Pinecone client
 * @param {Object} config - Pinecone configuration
 * @returns {Object} - Pinecone client wrapper
 */
function initPineconeClient(config) {
  const { endpoint, apiKey, namespace = '' } = config;

  if (!endpoint || !apiKey) {
    throw new Error('Pinecone endpoint and API key are required');
  }

  const indexName = extractPineconeIndexName(endpoint);

  return {
    async upsert(documents) {
      const headers = {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      };

      const vectors = documents.map(doc => ({
        id: doc.id,
        values: doc.values,
        metadata: doc.metadata || {},
      }));

      const response = await fetch(`${endpoint}/vectors/upsert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vectors,
          namespace,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinecone upsert failed: ${error}`);
      }

      return response.json();
    },

    async query(vector, topK = 5) {
      const headers = {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${endpoint}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vector,
          topK,
          includeMetadata: true,
          namespace,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinecone query failed: ${error}`);
      }

      const result = await response.json();
      
      return result.matches.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      }));
    },

    async deleteIndex() {
      // This is a no-op for Pinecone as the index is managed separately
      console.log(`Pinecone indexes must be deleted manually from the Pinecone console for: ${indexName}`);
      return { success: true };
    }
  };
}

/**
 * Initialize a Qdrant client
 * @param {Object} config - Qdrant configuration
 * @returns {Object} - Qdrant client wrapper
 */
function initQdrantClient(config) {
  const { endpoint, apiKey, collectionName } = config;

  if (!endpoint || !collectionName) {
    throw new Error('Qdrant endpoint and collection name are required');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'api-key': apiKey } : {}),
  };

  return {
    async upsert(documents) {
      const points = documents.map(doc => ({
        id: doc.id,
        vector: doc.values,
        payload: doc.metadata || {},
      }));

      const response = await fetch(`${endpoint}/points/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          points,
          wait: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Qdrant upsert failed: ${error}`);
      }

      return response.json();
    },

    async query(vector, topK = 5) {
      const response = await fetch(`${endpoint}/points/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vector,
          limit: topK,
          with_payload: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Qdrant query failed: ${error}`);
      }

      const result = await response.json();
      
      return result.result.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.payload,
      }));
    },

    async deleteIndex() {
      const response = await fetch(`${endpoint}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Qdrant collection deletion failed: ${error}`);
      }

      return { success: true };
    }
  };
}

/**
 * Initialize a Supabase client
 * @param {Object} config - Supabase configuration
 * @returns {Object} - Supabase client wrapper
 */
function initSupabaseClient(config) {
  const { endpoint, apiKey, tableName } = config;

  if (!endpoint || !apiKey || !tableName) {
    throw new Error('Supabase endpoint, API key, and table name are required');
  }

  const headers = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  return {
    async upsert(documents) {
      const rows = documents.map(doc => ({
        id: doc.id,
        embedding: doc.values,
        metadata: doc.metadata || {},
      }));

      const response = await fetch(`${endpoint}/rest/v1/${tableName}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase upsert failed: ${error}`);
      }

      return { success: true };
    },

    async query(vector, topK = 5) {
      const response = await fetch(`${endpoint}/rest/v1/rpc/match_documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query_embedding: vector,
          match_count: topK,
          table_name: tableName,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase query failed: ${error}`);
      }

      const results = await response.json();
      
      return results.map(match => ({
        id: match.id,
        score: match.similarity,
        metadata: match.metadata,
      }));
    },

    async deleteIndex() {
      const response = await fetch(`${endpoint}/rest/v1/${tableName}?truncate=true`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase table deletion failed: ${error}`);
      }

      return { success: true };
    }
  };
}

/**
 * Initialize a Firestore client
 * @param {Object} config - Firestore configuration
 * @returns {Object} - Firestore client wrapper
 */
function initFirestoreClient(config) {
  const { endpoint } = config;
  
  if (!endpoint) {
    throw new Error('Firestore endpoint is required');
  }

  // Extract collection path from firestore URI
  // Format: firestore://contexto-vectors/userId/pipelineId
  const path = endpoint.replace('firestore://', '');
  const [collection, userId, pipelineId] = path.split('/');
  
  if (!collection || !userId || !pipelineId) {
    throw new Error(`Invalid Firestore endpoint format: ${endpoint}`);
  }

  // Use Firestore REST API
  // Note: This assumes Firebase Auth is handled at the application level
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  
  return {
    async upsert(documents) {
      // Use batched writes for efficiency
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const writes = batch.map(doc => ({
          update: {
            name: `${baseUrl}/${collection}/${userId}/${pipelineId}/${doc.id}`,
            fields: {
              vector: { arrayValue: { values: doc.values.map(v => ({ doubleValue: v })) } },
              metadata: { 
                mapValue: { 
                  fields: convertToFirestoreFields(doc.metadata || {}) 
                } 
              },
              id: { stringValue: doc.id }
            }
          }
        }));

        batches.push(
          fetch(`${baseUrl}:batchWrite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes })
          }).then(response => {
            if (!response.ok) throw new Error(`Firestore batch write failed: ${response.statusText}`);
            return response.json();
          })
        );
      }

      await Promise.all(batches);
      return { success: true };
    },

    async query(vector, topK = 5) {
      // Firestore doesn't have vector search built-in
      // This is a naive implementation that retrieves all documents and filters in memory
      const response = await fetch(`${baseUrl}/${collection}/${userId}/${pipelineId}?pageSize=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firestore query failed: ${error}`);
      }

      const result = await response.json();
      const documents = result.documents || [];
      
      // Calculate cosine similarity
      const results = documents
        .filter(doc => doc.fields && doc.fields.vector && doc.fields.vector.arrayValue)
        .map(doc => {
          const docVector = doc.fields.vector.arrayValue.values.map(v => Number(v.doubleValue || v.integerValue || 0));
          const similarity = cosineSimilarity(vector, docVector);
          
          return {
            id: doc.fields.id.stringValue,
            score: similarity,
            metadata: convertFromFirestoreFields(doc.fields.metadata?.mapValue?.fields || {})
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      
      return results;
    },

    async deleteIndex() {
      const response = await fetch(`${baseUrl}/${collection}/${userId}/${pipelineId}?pageSize=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firestore query for deletion failed: ${error}`);
      }

      const result = await response.json();
      const documents = result.documents || [];
      
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const deletes = batch.map(doc => ({
          delete: doc.name
        }));

        batches.push(
          fetch(`${baseUrl}:batchWrite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes: deletes })
          }).then(response => {
            if (!response.ok) throw new Error(`Firestore batch delete failed: ${response.statusText}`);
            return response.json();
          })
        );
      }

      await Promise.all(batches);
      return { success: true };
    }
  };
}

/**
 * Extract Pinecone index name from endpoint URL
 * @param {string} endpoint - Pinecone endpoint URL
 * @returns {string} - Index name
 */
function extractPineconeIndexName(endpoint) {
  // Format: https://index-name-project.svc.environment.pinecone.io
  const match = endpoint.match(/https:\/\/(.*?)[-.].*\.pinecone\.io/);
  return match ? match[1] : 'unknown-index';
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Cosine similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Convert JS object to Firestore fields format
 * @param {Object} obj - JS object
 * @returns {Object} - Firestore fields object
 */
function convertToFirestoreFields(obj) {
  const result = {};

  for (const key in obj) {
    const value = obj[key];
    
    if (value === null || value === undefined) {
      result[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = { doubleValue: value };
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      result[key] = { 
        arrayValue: { 
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { doubleValue: v };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (typeof v === 'object' && v !== null) {
              return { mapValue: { fields: convertToFirestoreFields(v) } };
            }
            return { nullValue: null };
          })
        }
      };
    } else if (typeof value === 'object') {
      result[key] = { mapValue: { fields: convertToFirestoreFields(value) } };
    }
  }

  return result;
}

/**
 * Convert Firestore fields format to JS object
 * @param {Object} fields - Firestore fields object
 * @returns {Object} - JS object
 */
function convertFromFirestoreFields(fields) {
  const result = {};

  for (const key in fields) {
    const field = fields[key];
    
    if (field.nullValue !== undefined) {
      result[key] = null;
    } else if (field.stringValue !== undefined) {
      result[key] = field.stringValue;
    } else if (field.doubleValue !== undefined) {
      result[key] = field.doubleValue;
    } else if (field.integerValue !== undefined) {
      result[key] = Number(field.integerValue);
    } else if (field.booleanValue !== undefined) {
      result[key] = field.booleanValue;
    } else if (field.arrayValue !== undefined) {
      result[key] = (field.arrayValue.values || []).map(v => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.doubleValue !== undefined) return v.doubleValue;
        if (v.integerValue !== undefined) return Number(v.integerValue);
        if (v.booleanValue !== undefined) return v.booleanValue;
        if (v.mapValue !== undefined) return convertFromFirestoreFields(v.mapValue.fields || {});
        return null;
      });
    } else if (field.mapValue !== undefined) {
      result[key] = convertFromFirestoreFields(field.mapValue.fields || {});
    }
  }

  return result;
}
