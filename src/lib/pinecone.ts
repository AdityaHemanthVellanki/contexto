import { Pinecone } from "@pinecone-database/pinecone";

// Read env once
const API_KEY = process.env.PINECONE_API_KEY;
const ENV = process.env.PINECONE_ENVIRONMENT;
const INDEX_NAME = process.env.PINECONE_INDEX_NAME;

// Initialize client if configured
let index: any = null;

if (API_KEY && ENV && INDEX_NAME) {
  const client = new Pinecone({
    apiKey: API_KEY,
  });
  index = client.index(INDEX_NAME);
} else {
  console.warn("⚠️ Pinecone not fully configured; using no-op index");
}

// Export helper
export function getVectorIndex() {
  if (!index) {
    // No-op stub for local/dev
    return {
      upsert: async (params: any) => {
        console.log("[noop] upsert skipped", params);
        return Promise.resolve();
      },
      query: async (params: any) => {
        console.log("[noop] query skipped", params);
        return { matches: [] };
      },
    };
  }
  return index;
}

// Export configuration check
export function isPineconeConfigured() {
  return !!(API_KEY && ENV && INDEX_NAME);
}

// Export config for validation
export const pineconeConfig = {
  apiKey: API_KEY,
  environment: ENV,
  indexName: INDEX_NAME,
};
