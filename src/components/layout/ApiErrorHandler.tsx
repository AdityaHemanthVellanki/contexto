'use client';

import { ReactNode } from 'react';
import { useApiErrorInterceptor } from '@/lib/api-interceptor';

interface ApiErrorHandlerProps {
  children: ReactNode;
}

/**
 * Client component that applies the API error interceptor to catch authentication errors
 * This wraps the app to provide global error handling for API responses
 */
export default function ApiErrorHandler({ children }: ApiErrorHandlerProps) {
  // Initialize the API error interceptor
  useApiErrorInterceptor();
  
  // Simply render children, the interceptor works via side effects
  return <>{children}</>;
}
