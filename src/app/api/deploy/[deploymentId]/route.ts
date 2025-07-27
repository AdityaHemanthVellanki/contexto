import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { deploymentId: string } }
) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { deploymentId } = params;
    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    // Get deployment from Firestore
    const deploymentRef = doc(db, 'deployments', deploymentId);
    const deploymentDoc = await getDoc(deploymentRef);
    
    if (!deploymentDoc.exists()) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    const deploymentData = deploymentDoc.data();
    
    // Ensure the user has access to this deployment
    if (deploymentData.userId !== authResult.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Return deployment status
    return NextResponse.json({
      id: deploymentDoc.id,
      ...deploymentData,
    });
  } catch (error: any) {
    console.error('Error fetching deployment status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
