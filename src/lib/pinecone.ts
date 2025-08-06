import { Pinecone } from "@pinecone-database/pinecone";

let pinecone: Pinecone | null = null;

if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_INDEX_NAME) {
  throw new Error('Pinecone environment variables are not configured');
}

export const getPineconeClient = () => {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
  }
  return pinecone;
};

export const getPineconeIndex = () => {
  const client = getPineconeClient();
  return client.Index(process.env.PINECONE_INDEX_NAME!);
};
