import { getAuth, getIdToken } from 'firebase/auth';

// Define a simple notification interface that can be implemented with any UI library
interface NotificationOptions {
  duration?: number;
  position?: string;
}

// Default notification handler that logs to console
// This can be replaced with a UI notification system
const defaultNotify = {
  error: (message: string, _options?: NotificationOptions) => {
    console.error(`[API Error] ${message}`);
    return message; // Return for chaining
  },
  success: (message: string, _options?: NotificationOptions) => {
    console.log(`[API Success] ${message}`);
    return message;
  }
};

// Global notification handler that can be set by the application
let notifyHandler = defaultNotify;

// Export the notification interface for external implementations
export type { NotificationOptions };

/**
 * Secure API client that ensures Firebase ID token authentication for all requests
 * Uses the Firebase ID token from the authenticated user
 * Handles common error responses with appropriate messages
 */
export class SecureApiClient {
  /**
   * Set a custom notification handler for API errors and messages
   * @param handler The notification handler with error and success methods
   */
  static setNotificationHandler(handler: {
    error: (message: string, options?: NotificationOptions) => any;
    success: (message: string, options?: NotificationOptions) => any;
  }) {
    notifyHandler = handler;
  }

  /**
   * Make an authenticated GET request to an API endpoint
   * @param endpoint The API endpoint path (e.g., '/api/getUploadMeta')
   * @param queryParams Optional query parameters
   */
  static async get<T>(endpoint: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, queryParams);
  }

  /**
   * Make an authenticated POST request to an API endpoint
   * @param endpoint The API endpoint path
   * @param body The request body
   */
  static async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  /**
   * Make an authenticated PUT request to an API endpoint
   * @param endpoint The API endpoint path
   * @param body The request body
   */
  static async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, body);
  }

  /**
   * Make an authenticated DELETE request to an API endpoint
   * @param endpoint The API endpoint path
   * @param queryParams Optional query parameters
   */
  static async delete<T>(endpoint: string, queryParams?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, queryParams);
  }

  /**
   * Make an authenticated request to an API endpoint
   * @param method The HTTP method
   * @param endpoint The API endpoint path
   * @param body Optional request body
   * @param queryParams Optional query parameters
   * @private
   */
  private static async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    try {
      // Wait for auth state to be ready and get the current user
      const auth = getAuth();
      
      if (!auth.currentUser) {
        // Redirect to login if no user
        window.location.href = '/login';
        throw new Error('Authentication required. Please sign in.');
      }

      // Get a fresh ID token with each request
      const token = await getIdToken(auth.currentUser, true);

      // Build request URL with query parameters
      let url = endpoint;
      if (queryParams) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          params.append(key, value);
        });
        url = `${endpoint}?${params.toString()}`;
      }

      // Make the authenticated request
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`
      };
      
      // Only add Content-Type when there's a body
      if (body) {
        headers['Content-Type'] = 'application/json';
      }
      
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle common HTTP error codes
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        
        // Handle specific status codes with user-friendly messages
        switch (response.status) {
          case 401:
            notifyHandler.error('Session expired. Please sign in again.');
            // Force sign out on authentication failures
            auth.signOut().catch(console.error);
            window.location.href = '/login';
            break;
          case 403:
            notifyHandler.error('Access denied. You don\'t have permission to view this data.');
            break;
          case 404:
            notifyHandler.error('Resource not found.');
            break;
          case 429:
            notifyHandler.error('Too many requests. Please try again later.');
            break;
          default:
            notifyHandler.error(errorData.message || `Error: ${response.statusText}`);
        }

        throw new Error(`API error (${response.status}): ${errorData.message || response.statusText}`);
      }

      // Parse and return the successful response
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      // Re-throw the error for the caller to handle
      throw error;
    }
  }
}

// Usage example:
// import { SecureApiClient } from '@/lib/secure-api-client';
// 
// // GET request
// const fileMetadata = await SecureApiClient.get('/api/getUploadMeta', { fileId: 'abc123' });
// 
// // POST request
// const result = await SecureApiClient.post('/api/processPipeline', { fileId: 'abc123', purpose: 'analysis' });
