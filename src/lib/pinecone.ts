import { Pinecone } from "@pinecone-database/pinecone";

let pinecone: Pinecone | null = null;

if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing Pinecone config: set PINECONE_API_KEY and PINECONE_INDEX_NAME');
}

export const getPineconeClient = () => {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
      // Note: environment is no longer required in the v2 SDK constructor
    });
  }
  return pinecone;
};

export const getPineconeIndex = () => {
  const client = getPineconeClient();
  return client.index(process.env.PINECONE_INDEX_NAME!);
};
