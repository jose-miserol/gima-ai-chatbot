'use client';

import { cn } from '@/app/lib/utils';

interface MessageSkeletonProps {
  role?: 'user' | 'assistant';
  className?: string;
}

export function MessageSkeleton({ role = 'assistant', className }: MessageSkeletonProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex w-full animate-pulse',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 space-y-2',
          isUser ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-zinc-100 dark:bg-zinc-800'
        )}
      >
        {/* Simulated text lines */}
        <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-48" />
        <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-36" />
        {!isUser && <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-52" />}
      </div>
    </div>
  );
}

export function ChatSkeleton({ messageCount = 3 }: { messageCount?: number }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: messageCount }).map((_, i) => (
        <MessageSkeleton key={i} role={i % 2 === 0 ? 'user' : 'assistant'} />
      ))}
    </div>
  );
}
