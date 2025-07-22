import { FirebaseError } from 'firebase-admin';

/**
 * Standardized error handling for Firebase/Firestore operations
 * Provides consistent error responses across all API endpoints
 */
export class FirestoreErrorHandler {
  /**
   * Handle a Firestore operation error and return a standardized error object
   * @param error The error object from Firestore/Firebase operation
   * @param operation Description of the operation (e.g., 'reading document', 'updating pipeline')
   * @param resource The resource being operated on (e.g., 'uploads/123', 'pipeline abc')
   */
  static handleError(error: unknown, operation: string, resource: string): {
    statusCode: number;
    error: string;
    message: string;
    code?: string;
    details?: string;
  } {
    console.error(`Error ${operation} ${resource}:`, error);
    
    // Handle Firebase-specific errors
    if ((error as FirebaseError).code) {
      const fbError = error as FirebaseError;
      
      // Permission-related errors
      if (fbError.code === 'permission-denied') {
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: `You don't have permission to ${operation} ${resource}.`,
          code: fbError.code,
          details: 'This resource may belong to another user or you may need additional permissions.'
        };
      }
      
      // Authentication errors
      if (fbError.code === 'unauthenticated' || fbError.code === 'auth/id-token-expired') {
        return {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required. Your session may have expired.',
          code: fbError.code,
          details: 'Please sign in again to continue.'
        };
      }
      
      // Not found errors
      if (fbError.code === 'not-found') {
        return {
          statusCode: 404,
          error: 'Not Found',
          message: `The ${resource} you're trying to ${operation} does not exist.`,
          code: fbError.code
        };
      }
      
      // Quota exceeded
      if (fbError.code === 'resource-exhausted') {
        return {
          statusCode: 429,
          error: 'Resource Exhausted',
          message: 'Operation quota exceeded. Please try again later.',
          code: fbError.code,
          details: 'This may be due to high request volume or reaching your usage limits.'
        };
      }
      
      // Generic Firebase error
      return {
        statusCode: 500,
        error: 'Firebase Error',
        message: fbError.message || `Error ${operation} ${resource}.`,
        code: fbError.code,
        details: 'A database operation error occurred.'
      };
    }
    
    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      statusCode: 500,
      error: 'Internal Server Error',
      message: errorMessage,
      details: `Error ${operation} ${resource}.`
    };
  }
  
  /**
   * Wraps a Firestore operation in try/catch with standardized error handling
   * @param operation The function performing the Firestore operation
   * @param operationName Description of the operation
   * @param resourceName The resource being operated on
   */
  static async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    resourceName: string
  ): Promise<{
    success: boolean;
    data?: T;
    error?: ReturnType<typeof FirestoreErrorHandler.handleError>;
  }> {
    try {
      const result = await operation();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, operationName, resourceName)
      };
    }
  }
}

// Usage example:
/*
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }
    
    const { fileId } = getSearchParams(request, { fileId: true });
    const userId = authResult.userId!;
    
    const db = await getFirestoreAdmin();
    
    // Use the error handler to execute Firestore operation
    const result = await FirestoreErrorHandler.executeOperation(
      async () => {
        const fileRef = db.collection('uploads').doc(fileId);
        const fileDoc = await fileRef.get();
        
        // Explicit ownership check
        if (!fileDoc.exists) throw new Error('not-found');
        if (fileDoc.data()?.userId !== userId) {
          const error = new Error('Permission denied');
          (error as any).code = 'permission-denied';
          throw error;
        }
        
        return fileDoc.data();
      },
      'retrieving',
      `file ${fileId}`
    );
    
    if (!result.success) {
      return NextResponse.json(result.error, { status: result.error.statusCode });
    }
    
    return NextResponse.json(result.data);
  } catch (error) {
    const errorResponse = FirestoreErrorHandler.handleError(
      error,
      'processing request',
      'file metadata'
    );
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}
*/
