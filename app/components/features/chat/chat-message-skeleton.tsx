'use client';

import { cn } from '@/app/lib/utils';

interface MessageSkeletonProps {
  role?: 'user' | 'assistant';
  className?: string;
}

export function ChatMessageSkeleton({ role = 'assistant', className }: MessageSkeletonProps) {
  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg animate-pulse',
        role === 'user' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-gray-50 dark:bg-gray-800/50',
        className
      )}
      role="status"
      aria-busy="true"
      aria-label="Cargando mensaje"
    >
      {/* Avatar skeleton */}
      <div className="size-8 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
      </div>

      {/* Screen reader only text */}
      <span className="sr-only">Cargando mensaje...</span>
    </div>
  );
}

export function ChatSkeleton({ messageCount = 3 }: { messageCount?: number }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: messageCount }).map((_, i) => (
        <ChatMessageSkeleton key={i} role={i % 2 === 0 ? 'user' : 'assistant'} />
      ))}
    </div>
  );
}
