import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

/**
 * A utility function that merges class names using clsx and tailwind-merge
 * This allows for conditional class assignment with proper overrides
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
