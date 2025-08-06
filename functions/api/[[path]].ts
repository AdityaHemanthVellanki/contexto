import { handleUpload } from './upload';
import { handleProcess } from './process';

// This is the main entry point for all API routes
export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Route requests to the appropriate handler
    if (path.startsWith('/api/upload')) {
      return handleUpload(request, env);
    } else if (path.startsWith('/api/process')) {
      return handleProcess(request, env);
    }

    // Return 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        } 
      }
    );
  }
};
