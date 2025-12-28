'use client';

import { cn } from '@/app/lib/utils';

interface AudioWaveformProps {
  active?: boolean;
  className?: string;
}

/**
 * Componente de visualización de forma de onda de audio animada
 * Muestra barras animadas cuando el estado está activo
 * @param root0
 * @param root0.active
 * @param root0.className
 */
export function AudioWaveform({ active = false, className }: AudioWaveformProps) {
  return (
    <div className={cn('flex items-center gap-0.5 h-4', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full bg-current transition-all duration-300',
            active ? 'animate-music-bar' : 'h-1 opacity-20'
          )}
          style={{
            height: active ? undefined : '4px',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
