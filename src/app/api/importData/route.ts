import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    // Get the current authenticated user
    const session = await auth.currentUser;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // In a real implementation, this would process uploaded files
    // Process the import data and log to Firestore
    
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    
    console.log(`[importData] Redirecting ${files.length} files to pipeline processing...`);
    
    // For backward compatibility, we'll redirect this to the main pipeline
    // Users should use /api/uploads for file upload and /api/processPipeline for processing
    
    return NextResponse.json({ 
      success: false, 
      message: 'Please use /api/uploads for file upload and /api/processPipeline for processing',
      redirect: {
        upload: '/api/uploads',
        process: '/api/processPipeline'
      },
      fileCount: files.length
    }, { status: 301 });
    
  } catch (error) {
    console.error('Error in importData:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
