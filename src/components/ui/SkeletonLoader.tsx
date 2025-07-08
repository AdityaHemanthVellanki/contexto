import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangle' | 'circle' | 'text' | 'card';
  width?: string;
  height?: string;
}

export default function Skeleton({
  className,
  variant = 'rectangle',
  width,
  height,
}: SkeletonProps) {
  const baseClassName = "animate-pulse bg-gray-200 dark:bg-gray-700";
  
  const variantClassNames = {
    rectangle: "rounded-md",
    circle: "rounded-full",
    text: "rounded-md h-4",
    card: "rounded-lg shadow-sm h-24"
  };
  
  return (
    <div 
      className={cn(
        baseClassName,
        variantClassNames[variant],
        className
      )}
      style={{
        width: width,
        height: height
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6 max-w-4xl w-full mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-8 space-y-3">
        <Skeleton variant="text" className="w-1/3 h-8 mx-auto" />
        <Skeleton variant="text" className="w-2/3 h-4 mx-auto" />
      </div>
      
      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-[70vh] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <Skeleton variant="text" className="w-1/3 h-5" />
            <div className="flex space-x-2">
              <Skeleton variant="circle" className="w-8 h-8" />
              <Skeleton variant="circle" className="w-8 h-8" />
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-3/4">
                <Skeleton variant="card" className="w-full" />
                <Skeleton variant="card" className="w-full" />
                <Skeleton variant="card" className="w-full" />
                <Skeleton variant="card" className="w-full" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-[70vh]">
          <div className="mb-4 flex space-x-1">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} variant="text" className="w-1/4 h-6" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton variant="rectangle" className="w-full h-12" />
            <Skeleton variant="rectangle" className="w-full h-12" />
            <Skeleton variant="rectangle" className="w-full h-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
