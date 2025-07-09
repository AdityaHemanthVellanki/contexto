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
  const maxRetries = 2; // Allow more retries for better resilience
  
  // Try to refresh token preemptively if it might be expiring soon
  await preemptiveTokenRefresh();
  
  async function attemptFetch(): Promise<Response> {
    try {
      const token = await getAuthToken();
      
      if (!token) {
        console.warn('No token available, attempting to get a fresh one');
        // Try to get a fresh token if current user exists
        if (auth.currentUser) {
          try {
            const freshToken = await auth.currentUser.getIdToken(true);
            sessionStorage.setItem('authToken', freshToken);
            console.log('Successfully retrieved fresh token');
          } catch (freshTokenError) {
            console.error('Failed to get fresh token:', freshTokenError);
            // Continue with request even without token - the API might handle this
          }
        }
      }
      
      // Get token again (might have been refreshed above)
      const finalToken = await getAuthToken();
      
      // Create headers with auth token if available
      const headers = new Headers(options.headers);
      if (finalToken) {
        headers.set('Authorization', `Bearer ${finalToken}`);
      }
      
      // Make the API request with auth header
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle 401 Unauthorized and 403 Forbidden errors
      if (response.status === 401 || response.status === 403) {
        if (retryCount < maxRetries) {
          console.log(`${response.status} error detected, forcing token refresh... (attempt ${retryCount + 1})`);
          retryCount++;
          
          // Force token refresh with exponential backoff
          const backoffMs = Math.min(1000 * (2 ** retryCount), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          
          const user = auth.currentUser;
          if (user) {
            try {
              // Force get a new token
              const newToken = await user.getIdToken(true);
              console.log('Token refreshed successfully, retrying request');
              sessionStorage.setItem('authToken', newToken);
              
              // Clear any cached responses for this URL
              await clearCacheForUrl(url);
              
              // Retry the fetch with new token
              return attemptFetch();
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError);
              // Instead of throwing error, we'll try to continue anyway
              // Sometimes the request can succeed even with auth errors
            }
          }
        } else {
          console.error('Max token refresh retries exceeded');
          // Don't throw here - let the API response return to the caller
          // This prevents unnecessary redirects to login
        }
      }
      
      // For other non-2xx errors
      if (!response.ok && response.status !== 401 && response.status !== 403) {
        console.error(`API request failed: ${response.status} ${response.statusText || ''}`);
        // Don't throw - return the response and let the caller handle it
      }
      
      return response;
    } catch (error) {
      console.error('Error in fetchWithAuth:', error);
      
      // Create a more user-friendly error response instead of throwing
      // This prevents components from crashing and allows for graceful handling
      const errorResponse = new Response(JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'FETCH_ERROR'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Add custom property to identify this as a handled error
      Object.defineProperty(errorResponse, 'isHandledError', { value: true });
      
      return errorResponse;
    }
  }
  
  return attemptFetch();
};

export default { getAuthToken, fetchWithAuth };
