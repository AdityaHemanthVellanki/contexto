import { User } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, deleteDoc, DocumentData, WhereFilterOp, QueryConstraint, DocumentReference } from 'firebase/firestore';
import { SecureApiClient } from './secure-api-client';

/**
 * SecureFirestore provides a security-first approach to Firestore operations
 * 
 * It forces routes through the server-side API for sensitive data operations
 * while allowing direct Firestore access for non-sensitive client-rendered UI data.
 * 
 * Rules for usage:
 * 1. For sensitive data (uploads, pipelines, user data) - use the API methods
 * 2. For public/UI data only - use the direct methods
 */
export class SecureFirestore {
  /**
   * Get document data through an API endpoint for sensitive collections
   * @param collectionPath Firestore collection path
   * @param documentId Document ID
   * @returns Document data from API endpoint
   */
  static async getDocumentViaApi<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    return SecureApiClient.get<T>(endpoint, params);
  }
  
  /**
   * Create document through an API endpoint for sensitive collections
   * @param endpoint API endpoint path
   * @param data Document data
   * @returns Response from API endpoint
   */
  static async createDocumentViaApi<T>(endpoint: string, data: any): Promise<T> {
    return SecureApiClient.post<T>(endpoint, data);
  }
  
  /**
   * Update document through an API endpoint for sensitive collections
   * @param endpoint API endpoint path
   * @param data Document data
   * @returns Response from API endpoint
   */
  static async updateDocumentViaApi<T>(endpoint: string, data: any): Promise<T> {
    return SecureApiClient.put<T>(endpoint, data);
  }
  
  /**
   * Delete document through an API endpoint for sensitive collections
   * @param endpoint API endpoint path
   * @param params Query parameters
   * @returns Response from API endpoint
   */
  static async deleteDocumentViaApi<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    return SecureApiClient.delete<T>(endpoint, params);
  }
  
  /**
   * Check if the collection requires server API access based on security rules
   * @param collectionPath The collection path
   * @returns true if the collection requires API access, false otherwise
   */
  static requiresApiAccess(collectionPath: string): boolean {
    // List of collections that require server-side API access for CRUD operations
    const protectedCollections = [
      'uploads',
      'pipelines',
      'exports',
      'conversations',
      'usage',
      'embeddings'
    ];
    
    // Check if any protected collection is in the path
    return protectedCollections.some(col => 
      collectionPath.startsWith(col + '/') || 
      collectionPath === col ||
      collectionPath.includes(`/${col}/`)
    );
  }
  
  /**
   * Safe wrapper for Firestore document access
   * Routes through API for sensitive data, direct access for public data
   */
  static async getDocument<T = DocumentData>(
    collectionPath: string, 
    documentId: string,
    apiEndpoint?: string
  ): Promise<T | null> {
    // Check if this collection requires API access
    if (this.requiresApiAccess(collectionPath)) {
      if (!apiEndpoint) {
        throw new Error(
          `API endpoint is required for protected collection: ${collectionPath}. ` +
          `Use an API endpoint or SecureApiClient instead of direct Firestore access.`
        );
      }
      
      // Use the API endpoint
      return SecureApiClient.get<T>(apiEndpoint, { id: documentId });
    } else {
      // For non-sensitive data, use direct Firestore access
      const db = getFirestore();
      const docRef = doc(db, collectionPath, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as T;
      } else {
        return null;
      }
    }
  }
  
  /**
   * Safe wrapper for Firestore queries
   * Forces API usage for sensitive collections
   */
  static async getDocuments<T = DocumentData>(
    collectionPath: string,
    constraints: [string, WhereFilterOp, any][],
    apiEndpoint?: string
  ): Promise<T[]> {
    // Check if this collection requires API access
    if (this.requiresApiAccess(collectionPath)) {
      if (!apiEndpoint) {
        throw new Error(
          `API endpoint is required for protected collection: ${collectionPath}. ` +
          `Use an API endpoint or SecureApiClient instead of direct Firestore access.`
        );
      }
      
      // Transform constraints into query parameters for the API
      const params: Record<string, string> = {};
      constraints.forEach(([field, op, value]) => {
        params[field] = String(value);
        if (op !== '==') params[`${field}_op`] = op;
      });
      
      // Use the API endpoint
      return SecureApiClient.get<T[]>(apiEndpoint, params);
    } else {
      // For non-sensitive data, use direct Firestore access
      const db = getFirestore();
      const queryConstraints: QueryConstraint[] = constraints.map(
        ([field, op, value]) => where(field, op, value)
      );
      
      const q = query(collection(db, collectionPath), ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => doc.data() as T);
    }
  }
}

// Usage examples:
/*
// For uploads (sensitive data) - use API
const file = await SecureFirestore.getDocumentViaApi('/api/getUploadMeta', { fileId: 'abc123' });

// For public data (e.g., public templates) - can use direct access
const template = await SecureFirestore.getDocument('public_templates', 'template123');

// Always prefer API endpoints for sensitive operations
const result = await SecureFirestore.createDocumentViaApi('/api/processPipeline', { 
  fileId: 'abc123', 
  purpose: 'analysis'
});
*/
