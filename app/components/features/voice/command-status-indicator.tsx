'use client';

import { Loader2, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import type { CommandStatus } from '@/app/hooks/use-work-order-commands';

/**
 * Configuración visual para cada estado
 */
const STATUS_CONFIG: Record<
  CommandStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    className: string;
    animate?: boolean;
  }
> = {
  idle: {
    icon: Clock,
    label: 'Listo',
    className: 'text-gray-500 dark:text-gray-400',
  },
  validating: {
    icon: Loader2,
    label: 'Validando...',
    className: 'text-blue-500 dark:text-blue-400',
    animate: true,
  },
  executing: {
    icon: Loader2,
    label: 'Ejecutando...',
    className: 'text-amber-500 dark:text-amber-400',
    animate: true,
  },
  retrying: {
    icon: RefreshCw,
    label: 'Reintentando...',
    className: 'text-orange-500 dark:text-orange-400',
    animate: true,
  },
  succeeded: {
    icon: CheckCircle,
    label: 'Completado',
    className: 'text-green-500 dark:text-green-400',
  },
  failed: {
    icon: XCircle,
    label: 'Error',
    className: 'text-red-500 dark:text-red-400',
  },
};

interface CommandStatusIndicatorProps {
  /** Estado actual del comando */
  status: CommandStatus;
  /** Mensaje opcional para mostrar */
  message?: string;
  /** Duración de la ejecución en ms */
  duration?: number | null;
  /** Clases CSS adicionales */
  className?: string;
  /** Si debe mostrarse en modo compacto */
  compact?: boolean;
}

/**
 * CommandStatusIndicator - Muestra el estado de ejecución del comando
 *
 * Visualiza el progreso del comando con iconos animados y mensajes
 * contextuales según el estado actual.
 */
export function CommandStatusIndicator({
  status,
  message,
  duration,
  className,
  compact = false,
}: CommandStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // No mostrar nada en idle si es compacto
  if (compact && status === 'idle') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
        status === 'failed' && 'bg-red-50 dark:bg-red-900/20',
        status === 'succeeded' && 'bg-green-50 dark:bg-green-900/20',
        (status === 'executing' || status === 'validating') && 'bg-amber-50 dark:bg-amber-900/20',
        status === 'retrying' && 'bg-orange-50 dark:bg-orange-900/20',
        className
      )}
    >
      <Icon
        className={cn('h-4 w-4 flex-shrink-0', config.className, config.animate && 'animate-spin')}
      />

      <div className="flex-1 min-w-0">
        <span className={cn('text-sm font-medium', config.className)}>{config.label}</span>

        {message && (
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">{message}</p>
        )}

        {duration !== undefined && duration !== null && status !== 'idle' && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {(duration / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  );
}
