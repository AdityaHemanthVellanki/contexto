import React from 'react';
import Image from 'next/image';
import { cn } from '@/utils/cn';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12'
  };
  
  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      {/* Using the contexto-logo.svg file from public directory */}
      <div className="relative flex items-center justify-center">
        <Image 
          src="/contexto-logo.svg" 
          alt="Contexto Logo" 
          width={sizeClasses[size] === 'h-6' ? 24 : sizeClasses[size] === 'h-8' ? 32 : 48}
          height={sizeClasses[size] === 'h-6' ? 24 : sizeClasses[size] === 'h-8' ? 32 : 48}
          className="h-full text-blue-600 dark:text-blue-400"
        />
      </div>
      {showText && (
        <span className="ml-2 text-xl font-bold text-gray-900 dark:text-gray-100">Contexto</span>
      )}
    </div>
  );
}
