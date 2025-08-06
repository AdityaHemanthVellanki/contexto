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

export async function handleRequest(
  context: EventContext<Env, string, unknown>,
  handler: (context: EventContext<Env, string, unknown>) => Promise<Response>
): Promise<Response> {
  const { request } = context;
  
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const response = await handler(context);
    
    // Add CORS headers to all responses
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    
    return response;
  } catch (error) {
    console.error('Request failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
}
