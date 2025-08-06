/// <reference types="@cloudflare/workers-types" />

interface Env {
  UPLOADS: R2Bucket;
  ENV: {
    AZURE_OPENAI_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_DEPLOYID: string;
    PINECONE_API_KEY: string;
    PINECONE_ENV: string;
  };
}

declare const process: {
  env: {
    NODE_ENV: 'development' | 'production';
  };
};

// Extend the global scope with our custom types
declare global {
  // This extends the global Request type to include the cf object
  interface RequestInit {
    cf?: IncomingRequestCfProperties;
  }

  // This extends the global Response type to include the webSocket property
  interface ResponseInit {
    webSocket?: WebSocket;
  }
}
