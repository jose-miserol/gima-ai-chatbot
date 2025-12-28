/**
 * AIStatusBadge - Badge visual para estados de IA
 *
 * Muestra estado de generación con colores, iconos y tooltips con detalles.
 */

'use client';

import { Loader2, CheckCircle2, XCircle, Sparkles, AlertTriangle, Clock } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn } from '@/app/lib/utils';

import type { AIGenerationStatus } from './types';

/**
 * Props para AIStatusBadge
 */
export interface AIStatusBadgeProps {
  /** Estado actual */
  status: AIGenerationStatus;
  /** Detalles adicionales para el tooltip */
  details?: string;
  /** Mostrar como compact (solo icono) */
  compact?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/** Configuración de estados */
const STATUS_CONFIG = {
  idle: {
    label: 'Listo',
    variant: 'outline' as const,
    icon: Sparkles,
    className: '',
    animate: false,
  },
  generating: {
    label: 'Generando',
    variant: 'default' as const,
    icon: Loader2,
    className: '',
    animate: true,
  },
  success: {
    label: 'Completado',
    variant: 'default' as const,
    icon: CheckCircle2,
    className: 'bg-green-500 hover:bg-green-600',
    animate: false,
  },
  error: {
    label: 'Error',
    variant: 'destructive' as const,
    icon: XCircle,
    className: '',
    animate: false,
  },
  cached: {
    label: 'En caché',
    variant: 'secondary' as const,
    icon: Sparkles,
    className: '',
    animate: false,
  },
  rate_limited: {
    label: 'Límite alcanzado',
    variant: 'destructive' as const,
    icon: AlertTriangle,
    className: 'bg-amber-500 hover:bg-amber-600',
    animate: false,
  },
  timeout: {
    label: 'Tiempo agotado',
    variant: 'destructive' as const,
    icon: Clock,
    className: '',
    animate: false,
  },
} as const;

/**
 * Badge de estado para generaciones de IA
 *
 * Features:
 * - 7 estados diferentes (idle, generating, success, error, cached, rate_limited, timeout)
 * - Tooltip con detalles adicionales
 * - Modo compacto (solo icono)
 * - Animación para estado generating
 * @param root0
 * @param root0.status
 * @param root0.details
 * @param root0.compact
 * @param root0.className
 */
export function AIStatusBadge({
  status,
  details,
  compact = false,
  className,
}: AIStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = config.icon;

  const badge = (
    <Badge
      variant={config.variant}
      className={cn('gap-1', config.className, className)}
    >
      <Icon className={cn('h-3 w-3', config.animate && 'animate-spin')} />
      {!compact && <span>{config.label}</span>}
    </Badge>
  );

  if (!details) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{details}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
