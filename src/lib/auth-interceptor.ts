/**
 * Auth Interceptor - Provides centralized token management and refresh
 * 
 * This interceptor handles authentication tokens for all API calls
 * and automatically refreshes tokens when they're about to expire.
 */

import { User, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
// Import the same auth instance that's used throughout the application
import { auth } from '@/utils/firebase';

// In-memory token cache with timestamp
interface TokenCache {
  token: string;
  timestamp: number;
}

// Cache for responses to avoid excessive network calls
const responseCache = new Map<string, Response>();

/**
 * Clear cached responses for a specific URL
 */
async function clearCacheForUrl(url: string): Promise<void> {
  responseCache.delete(url);
}

/**
 * Preemptively refresh the token if it's older than 30 minutes
 * This helps prevent token expiration during user sessions
 */
async function preemptiveTokenRefresh(): Promise<void> {
  try {
    const cachedToken = sessionStorage.getItem('authToken');
    if (!cachedToken) return;
    
    // Decode the JWT token to check its expiration time
    const tokenParts = cachedToken.split('.');
    if (tokenParts.length !== 3) return;
    
    try {
      // Get the payload part of the JWT
      const payload = JSON.parse(atob(tokenParts[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeToExpiry = expiryTime - currentTime;
      
      // If token will expire in less than 15 minutes, refresh it
      if (timeToExpiry < 15 * 60 * 1000) {
        console.log('Token will expire soon, refreshing preemptively');
        const user = auth.currentUser;
        if (user) {
          const freshToken = await user.getIdToken(true);
          sessionStorage.setItem('authToken', freshToken);
          console.log('Preemptive token refresh successful');
        }
      }
    } catch (e) {
      console.error('Error during preemptive token refresh:', e);
    }
  } catch (error) {
    // Silently fail for preemptive refresh
    console.warn('Preemptive token refresh failed:', error);
  }
}

/**
 * Time buffer in ms before token expiry when we should refresh (5 minutes)
 */
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;

/**
 * Token manager singleton to handle token refreshes
 */
class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string> | null = null;
  private tokenExpiry: number = 0;
  
  private constructor() {}
  
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }
  
  /**
   * Get a valid token, refreshing if necessary
   */
  public async getToken(user: User | null): Promise<string> {
    if (!user) {
      throw new Error('No user available for token');
    }
    
    // If a token refresh is in progress, wait for it to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // Check if token is close to expiry
    const now = Date.now();
    if (now >= this.tokenExpiry - TOKEN_REFRESH_BUFFER) {
      console.log('Token expired or close to expiry, refreshing...');
      this.refreshPromise = this.refreshToken(user);
      const token = await this.refreshPromise;
      this.refreshPromise = null;
      return token;
    }
    
    // Try to get token from session storage first
    const cachedToken = sessionStorage.getItem('authToken');
    if (cachedToken) {
      return cachedToken;
    }
    
    // If no cached token, force a refresh
    console.log('No cached token, forcing refresh');
    this.refreshPromise = this.refreshToken(user);
    const token = await this.refreshPromise;
    this.refreshPromise = null;
    return token;
  }
  
  /**
   * Refresh the auth token and update session storage
   */
  private async refreshToken(user: User): Promise<string> {
    try {
      // Force token refresh
      const token = await user.getIdToken(true);
      
      // Store token in session storage
      sessionStorage.setItem('authToken', token);
      
      // Parse and extract expiry time from JWT
      const payload = this.parseJwt(token);
      if (payload && payload.exp) {
        this.tokenExpiry = payload.exp * 1000; // Convert to ms
        console.log(`Token refreshed, expires at: ${new Date(this.tokenExpiry).toISOString()}`);
      } else {
        // Default to 1 hour if we can't extract expiry
        this.tokenExpiry = Date.now() + 60 * 60 * 1000;
        console.log('Could not extract token expiry, using default 1 hour');
      }
      
      return token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }
  
  /**
   * Parse JWT token payload
   */
  private parseJwt(token: string): any {
    try {
      // Split the token and get the payload part
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      // Handle base64 padding
      const padding = '='.repeat((4 - base64.length % 4) % 4);
      // Decode
      const jsonPayload = decodeURIComponent(
        atob(base64 + padding)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error parsing JWT token:', e);
      return null;
    }
  }
}

/**
 * Initialize the auth listeners
 * Call this as early as possible in your application
 */
export const initAuthListeners = () => {
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('Auth state changed - User logged in:', user.uid);
      // Immediately refresh token on auth state change
      user.getIdToken(true).then(token => {
        sessionStorage.setItem('authToken', token);
        console.log('Token refreshed and stored on auth state change');
      });
    } else {
      console.log('Auth state changed - User logged out');
      sessionStorage.removeItem('authToken');
    }
  });

  // Listen for ID token changes
  onIdTokenChanged(auth, (user) => {
    if (user) {
      console.log('ID token changed for user:', user.uid);
      // Get new token
      user.getIdToken(true).then(token => {
        sessionStorage.setItem('authToken', token);
        console.log('Updated token stored after ID token change');
      });
    }
  });
};

/**
 * Get the current user's auth token with automatic refresh handling
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // First check sessionStorage for a cached token
    const cachedToken = sessionStorage.getItem('authToken');
    if (cachedToken) {
      // Verify token isn't expired
      const payload = parseJwt(cachedToken);
      if (payload && payload.exp && payload.exp * 1000 > Date.now() + 5 * 60 * 1000) {
        // Token is still valid for at least 5 minutes
        return cachedToken;
      }
    }
    
    // No valid cached token, get fresh one
    const user = auth.currentUser;
    if (!user) {
      console.warn('No authenticated user found when getting auth token');
      return null;
    }
    
    return await TokenManager.getInstance().getToken(user);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

/**
 * Parse JWT token payload
 */
export const parseJwt = (token: string): any => {
  try {
    // Split the token and get the payload part
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Handle base64 padding
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    // Decode
    const jsonPayload = decodeURIComponent(
      atob(base64 + padding)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error parsing JWT token:', e);
    return null;
  }
};

/**
 * Create a fetch wrapper that includes authorization header
 * with automatic token refresh on 401 errors
 * This version is more resilient, proactively refreshes tokens,
 * and uses a layered retry approach
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  let retryCount = 0;
  const maxRetries = 3; // Increased max retries for better resilience
  
  // Always ensure we have a valid user before proceeding
  const currentUser = auth.currentUser;
  
  // Proactively refresh token when making authenticated requests
  if (currentUser) {
    try {
      // Check token expiration time before forcing refresh
      const cachedToken = sessionStorage.getItem('authToken');
      let shouldRefresh = true;
      
      // Only check expiration if token exists
      if (cachedToken) {
        const payload = parseJwt(cachedToken);
        // Refresh if token will expire in 10 minutes or less
        if (payload && payload.exp) {
          const expiryTime = payload.exp * 1000;
          const timeRemaining = expiryTime - Date.now();
          shouldRefresh = timeRemaining < 10 * 60 * 1000; // 10 minutes
          if (shouldRefresh) {
            console.log(`Token will expire in ${Math.round(timeRemaining/1000)}s, refreshing...`);
          }
        }
      }
      
      // Only force refresh if needed to avoid excessive calls
      if (shouldRefresh) {
        const token = await currentUser.getIdToken(true);
        sessionStorage.setItem('authToken', token);
        console.log('Token refreshed before API call');
      }
    } catch (refreshError) {
      console.error('Error refreshing token before API call:', refreshError);
      // Continue with potentially cached token even if refresh fails
    }
  } else {
    // If no user, try to refresh the page session if we're in a browser context
    if (typeof window !== 'undefined') {
      console.warn('No current user found when making authenticated request');
    }
  }
  
  async function attemptFetch(): Promise<Response> {
    try {
      // Check if user is logged in first
      if (!currentUser) {
        console.warn('No authenticated user found');
        return new Response(JSON.stringify({
          error: true,
          message: 'Authentication required. Please sign in.',
          code: 'AUTH_REQUIRED'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get latest token
      const token = await getAuthToken();
      
      // If we've already retried, let's immediately attempt to refresh the token
      if (retryCount > 0 && token && currentUser) {
        try {
          // Force a token refresh
          const refreshedToken = await currentUser.getIdToken(true);
          sessionStorage.setItem('authToken', refreshedToken);
          // Use the refreshed token instead
          return fetch(url, {
            ...options,
            headers: new Headers({
              ...options.headers,
              'Authorization': `Bearer ${refreshedToken}`
            })
          });
        } catch (refreshError) {
          console.log('Failed to force refresh token after retry:', refreshError);
          // Continue with the token we have
        }
      }
      
      if (!token) {
        console.warn('No token available, forcing token refresh');
        // Always force token refresh if no token available
        try {
          const freshToken = await currentUser.getIdToken(true);
          sessionStorage.setItem('authToken', freshToken);
          console.log('Successfully retrieved fresh token');
          
          // Use the new token for this request
          const headers = new Headers(options.headers);
          headers.set('Authorization', `Bearer ${freshToken}`);
          
          // Make the API request with the fresh token
          return fetch(url, {
            ...options,
            headers
          });
        } catch (freshTokenError) {
          console.error('Failed to get fresh token:', freshTokenError);
          throw new Error('Authentication error. Unable to refresh authentication token.');
        }
      }
      
      // Create headers with auth token
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      
      // Make the API request with auth header
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Special handling for 401 Unauthorized errors
      if (response.status === 401) {
        // For any 401, attempt token refresh once regardless of error details
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Authentication error (401) detected, forcing token refresh... (attempt ${retryCount}/${maxRetries})`);
          
          try {
            // Force token refresh with exponential backoff
            const backoffMs = Math.min(1000 * (2 ** retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            
            // Force get a new token
            const newToken = await currentUser.getIdToken(true);
            console.log('Token refreshed successfully, retrying request');
            sessionStorage.setItem('authToken', newToken);
            
            // Clear any cached responses for this URL
            await clearCacheForUrl(url);
            
            // Retry the fetch with new token
            return attemptFetch();
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
            // Return a special response that indicates auth error but doesn't force logout
            return new Response(JSON.stringify({
              error: true,
              code: 'SESSION_EXPIRED',
              message: 'Your session has expired. Please sign in again.'
            }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          console.error('Max token refresh retries exceeded');
          // Return auth error but don't force logout
          return new Response(JSON.stringify({
            error: true,
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired after multiple retry attempts. Please sign in again.'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // For other non-2xx errors
      if (!response.ok && response.status !== 401) {
        console.error(`API request failed: ${response.status} ${response.statusText || ''}`);
        // Don't throw - return the response and let the caller handle it
      }
      
      return response;
    } catch (error) {
      console.error('Error in fetchWithAuth:', error);
      
      // Check if we have a specific auth error message to display
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during request';
      
      // Create a more user-friendly error response
      const errorResponse = new Response(JSON.stringify({
        error: true,
        message: errorMessage,
        code: errorMessage.includes('Authentication') ? 'AUTH_ERROR' : 'FETCH_ERROR'
      }), {
        status: errorMessage.includes('Authentication') ? 401 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
      
      return errorResponse;
    }
  }
  
  return attemptFetch();
};

export default { getAuthToken, fetchWithAuth };
