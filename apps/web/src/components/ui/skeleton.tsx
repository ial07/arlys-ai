/**
 * Skeleton Loader Component
 *
 * Provides visual feedback during loading states.
 * Multiple variants for different UI contexts.
 */

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circle" | "rect" | "message";
  width?: string;
  height?: string;
  count?: number;
}

export function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClass = "animate-pulse bg-white/5 rounded";

  const variants = {
    text: `${baseClass} h-4 ${width || "w-full"}`,
    circle: `${baseClass} rounded-full ${width || "w-10"} ${height || "h-10"}`,
    rect: `${baseClass} ${width || "w-full"} ${height || "h-20"}`,
    message: `${baseClass} h-4`,
  };

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${variants[variant]} ${className}`}
      style={{ width: width, height: height }}
    />
  ));

  return <>{elements}</>;
}

/**
 * Message Skeleton - Loading state for chat messages
 */
export function MessageSkeleton() {
  return (
    <div className="flex gap-4 animate-in fade-in duration-300">
      {/* Avatar */}
      <Skeleton variant="circle" width="32px" height="32px" />

      {/* Message content */}
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="120px" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  );
}

/**
 * Build Status Skeleton - Loading state for build progress
 */
export function BuildStatusSkeleton() {
  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-white/5 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton variant="circle" width="24px" height="24px" />
        <Skeleton variant="text" width="200px" />
      </div>
      <div className="space-y-2 pl-8">
        <Skeleton variant="text" width="150px" />
        <Skeleton variant="text" width="180px" />
        <Skeleton variant="text" width="120px" />
      </div>
      {/* Progress bar skeleton */}
      <Skeleton variant="rect" height="8px" className="rounded-full mt-4" />
    </div>
  );
}

/**
 * File List Skeleton - Loading state for file explorer
 */
export function FileListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2 animate-pulse">
          <Skeleton variant="rect" width="16px" height="16px" />
          <Skeleton variant="text" width={`${60 + Math.random() * 40}%`} />
        </div>
      ))}
    </div>
  );
}

/**
 * Preview Frame Skeleton - Loading state for preview iframe
 */
export function PreviewSkeleton() {
  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 animate-pulse">
      <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
      <Skeleton variant="text" width="200px" className="bg-white/10" />
      <Skeleton variant="text" width="150px" className="bg-white/5" />
    </div>
  );
}
