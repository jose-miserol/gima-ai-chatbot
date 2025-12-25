/**
 * AIStatusBadge - Badge visual para estados de IA
 *
 * Muestra estado de generación con colores e iconos consistentes.
 */

'use client';

import { Badge } from '@/app/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import type { AIGenerationStatus } from './types';

/**
 * Props para AIStatusBadge
 */
export interface AIStatusBadgeProps {
  /**
   * Estado actual
   */
  status: AIGenerationStatus;

  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Badge de estado para generaciones de IA
 */
export function AIStatusBadge({ status, className }: AIStatusBadgeProps) {
  const statusConfig = {
    idle: {
      label: 'Ready',
      variant: 'outline' as const,
      icon: null,
      className: undefined,
    },
    generating: {
      label: 'Generating',
      variant: 'default' as const,
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      className: undefined,
    },
    success: {
      label: 'Generated',
      variant: 'default' as const,
      icon: <CheckCircle2 className="h-3 w-3" />,
      className: 'bg-green-500',
    },
    error: {
      label: 'Error',
      variant: 'destructive' as const,
      icon: <XCircle className="h-3 w-3" />,
      className: undefined,
    },
    cached: {
      label: 'Cached',
      variant: 'secondary' as const,
      icon: <Sparkles className="h-3 w-3" />,
      className: undefined,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn('gap-1', config.className, className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
