import { NextRequest, NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse } from '@/lib/api-middleware';
import { getFirestore } from '@/lib/firebase-admin';

interface RouteParams {
  deploymentId: string;
}

type UiStatus = 'pending' | 'building' | 'deploying' | 'success' | 'failed';

function mapStatus(raw: unknown): UiStatus {
  const s = String(raw || '').toLowerCase();
  switch (s) {
    case 'pending':
    case 'queued':
      return 'pending';
    case 'building':
    case 'started':
      return 'building';
    case 'deploying':
    case 'releasing':
      return 'deploying';
    case 'deployed':
    case 'succeeded':
    case 'success':
      return 'success';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

function toIsoString(val: any): string | undefined {
  try {
    if (!val) return undefined;
    if (typeof val === 'string') return val;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      const d = val.toDate();
      if (d instanceof Date) return d.toISOString();
    }
    return new Date(val).toISOString();
  } catch {
    return undefined;
  }
}

export const GET = withAuth<RouteParams>(async (req: NextRequest, ctx?: { params: RouteParams }) => {
  try {
    const deploymentId = ctx?.params?.deploymentId;
    if (!deploymentId) {
      return errorResponse('Missing deploymentId', 400);
    }

    const db = await getFirestore();
    const ref = db.collection('deployments').doc(deploymentId);
    const snap = await ref.get();

    if (!snap.exists) {
      return errorResponse('Deployment not found', 404);
    }

    const raw = snap.data() as Record<string, any>;

    // Authorization: ensure the requester owns this deployment
    const ownerId = raw?.userId;
    if (!ownerId || ownerId !== (req as any).userId) {
      return errorResponse('Forbidden', 403);
    }

    const normalized = {
      id: snap.id,
      deploymentId: snap.id,
      status: mapStatus(raw?.status),
      createdAt: toIsoString(raw?.createdAt) || new Date().toISOString(),
      updatedAt: toIsoString(raw?.updatedAt) || new Date().toISOString(),
      logs: Array.isArray(raw?.logs) ? raw.logs : undefined,
      url: raw?.url || raw?.appUrl || raw?.webUrl,
      webUrl: raw?.webUrl || raw?.url || raw?.appUrl,
      appName: raw?.appName,
      buildId: raw?.buildId,
      error: raw?.error || raw?.errorMessage,
    };

    return successResponse(normalized, 200);
  } catch (error) {
    console.error('GET /api/deploy/[deploymentId] error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
