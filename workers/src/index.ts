import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.CF_R2_ENDPOINT!;
const R2_BUCKET_NAME = process.env.CF_R2_BUCKET_NAME!;
const R2_ACCESS_KEY_ID = process.env.CF_R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.CF_R2_SECRET_ACCESS_KEY!;

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: "auto",
  credentials: { 
    accessKeyId: R2_ACCESS_KEY_ID, 
    secretAccessKey: R2_SECRET_ACCESS_KEY 
  },
  forcePathStyle: true
});

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      // Expect path: /exports/:userId/:fileId/mcp-pipeline.zip
      const [, , userId, fileId] = url.pathname.split("/");
      
      if (!userId || !fileId) {
        return new Response("Bad request: Missing userId or fileId", { status: 400 });
      }

      // Generate a presigned GET URL valid for 1h
      const key = `users/${userId}/exports/${fileId}/mcp-pipeline.zip`;
      const cmd = new GetObjectCommand({ 
        Bucket: R2_BUCKET_NAME, 
        Key: key 
      });
      
      const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 });

      // Proxy the GET request to R2
      const upstream = await fetch(presignedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/zip',
          'Cache-Control': 'no-cache'
        }
      });

      if (!upstream.ok) {
        return new Response(`Upstream error: ${upstream.status}`, { 
          status: upstream.status,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // Return a streaming response with CORS
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "*");
      responseHeaders.set("Cache-Control", "public, max-age=3600");
      responseHeaders.set("Content-Type", "application/zip");
      responseHeaders.set("Content-Disposition", `attachment; filename="mcp-pipeline-${fileId}.zip"`);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(`Worker error: ${err instanceof Error ? err.message : 'Unknown error'}`, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
  
  // Handle OPTIONS for CORS preflight
  async options(request: Request): Promise<Response> {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
};
