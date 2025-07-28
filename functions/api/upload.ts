import type { Env } from '../src/types';

interface UploadResponse {
  success: boolean;
  key: string;
  url: string;
  name: string;
  size: number;
  type: string;
  error?: string;
}

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        } 
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields (file or userId)' 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      );
    }

    // Generate a unique key for the file
    const fileExt = file.name.split('.').pop();
    const key = `${userId}/${crypto.randomUUID()}.${fileExt}`;

    // Upload the file to R2
    await env.UPLOADS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        originalName: file.name,
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate a presigned URL for the file (valid for 1 hour)
    const signedUrl = await env.UPLOADS.getSignedUrl(
      key,
      { expiresIn: 3600 } // 1 hour
    );

    const response: UploadResponse = {
      success: true,
      key,
      url: signedUrl.toString(),
      name: file.name,
      size: file.size,
      type: file.type,
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    const response: UploadResponse = {
      success: false,
      key: '',
      url: '',
      name: '',
      size: 0,
      type: '',
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}
