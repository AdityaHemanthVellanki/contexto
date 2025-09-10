import { NextRequest } from 'next/server';
import { withAuth, errorResponse, successResponse, AuthenticatedRequest } from '@/lib/api-middleware';
import { getFirestore } from '@/lib/firebase-admin';
import { generateDownloadUrl } from '@/lib/r2-client';
import { buildAndUploadVSIX } from '@/lib/vscode-extension-builder';

// GET /api/extensions/[pipelineId]
export const GET = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) => {
  try {
    const { pipelineId } = await params;
    if (!pipelineId) {
      return errorResponse('Missing pipelineId', 400);
    }

    const db = await getFirestore();
    const doc = await db.collection('pipelines').doc(pipelineId).get();
    if (!doc.exists) {
      return errorResponse('Pipeline not found', 404);
    }
    const data = doc.data() as any;
    if (data?.userId !== req.userId) {
      return errorResponse('Not authorized to download this extension', 403);
    }

    let r2Key: string | undefined = data?.deployment?.extensionR2Key || undefined;
    if (!r2Key) {
      // Attempt to build the VSIX on-demand if we have a deployment endpoint
      const endpoint: string | undefined =
        data?.deployment?.appUrl || data?.deployment?.serviceUrl || data?.deploymentUrl;
      if (!endpoint) {
        return errorResponse('MCP not deployed yet for this pipeline', 409);
      }

      try {
        const vsix = await buildAndUploadVSIX({
          userId: req.userId,
          pipelineId,
          endpoint: endpoint.replace(/\/$/, ''),
          appName: data?.deployment?.appName || 'contexto-mcp'
        });
        r2Key = vsix.r2Key;
        // Persist to pipeline doc for future requests
        await (await getFirestore())
          .collection('pipelines')
          .doc(pipelineId)
          .set({ deployment: { extensionR2Key: r2Key, extensionUrl: vsix.downloadUrl } }, { merge: true });
      } catch (e: any) {
        return errorResponse(`Failed to build VS Code extension: ${e?.message || e}`, 500);
      }
    }

    const url = await generateDownloadUrl(r2Key);
    return successResponse({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`Failed to get extension download URL: ${msg}`, 500);
  }
});
