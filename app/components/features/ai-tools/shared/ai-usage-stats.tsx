/**
 * AIUsageStats - Métricas de uso de AI features
 *
 * Muestra estadísticas de uso con progress bar visual y warnings de límite.
 */

/* eslint-disable react-hooks/purity -- Date.now() en render es necesario para countdown */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useEffect, useMemo, useState } from 'react';

/** Threshold para mostrar warning (80%) */
const WARNING_THRESHOLD = 80;

/**
 * Estadísticas de uso individual
 */
export interface FeatureUsage {
  /** Nombre de la feature */
  name: string;
  /** Cantidad usada */
  used: number;
  /** Cuota máxima */
  quota: number;
  /** Tendencia de uso */
  trend?: 'up' | 'down' | 'stable';
}

/**
 * Props para AIUsageStats
 */
export interface AIUsageStatsProps {
  /** ID único para persistencia en localStorage */
  storageKey?: string;
  /** Features a mostrar (si no se provee, se lee de localStorage) */
  features?: FeatureUsage[];
  /** Fecha de reset de cuota */
  resetDate?: Date;
  /** Mostrar título */
  showTitle?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Componente de estadísticas de uso
 *
 * Features:
 * - Progress bar visual por feature
 * - Warning cuando uso >= 80%
 * - Indicador de tendencia (up/down/stable)
 * - Countdown para reset de cuota
 * - Persistencia en localStorage
 */
export function AIUsageStats({
  storageKey = 'ai-usage-stats',
  features: propFeatures,
  resetDate,
  showTitle = true,
  className,
}: AIUsageStatsProps) {
  const [features, setFeatures] = useState<FeatureUsage[]>(propFeatures || []);

  // Cargar de localStorage si no se provee features
  useEffect(() => {
    if (propFeatures) {
      setFeatures(propFeatures);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFeatures(parsed);
        }
      }
    } catch {
      // Ignorar errores
    }
  }, [storageKey, propFeatures]);

  // Calcular días hasta reset

  const daysUntilReset = resetDate
    ? Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Calcular totales de uso (memoizado)
  const { totalUsed, totalQuota, totalPercentage } = useMemo(() => {
    const used = features.reduce((sum, f) => sum + f.used, 0);
    const quota = features.reduce((sum, f) => sum + f.quota, 0);
    const percentage = quota > 0 ? (used / quota) * 100 : 0;
    return { totalUsed: used, totalQuota: quota, totalPercentage: percentage };
  }, [features]);

  if (features.length === 0) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span className="text-sm">No hay estadísticas de uso disponibles</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Uso de IA este mes
            </CardTitle>
            {daysUntilReset !== null && (
              <Badge variant="outline" className="text-xs">
                Reinicia en {daysUntilReset} días
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(!showTitle && 'pt-6')}>
        <div className="space-y-4">
          {/* Total Overview */}
          {features.length > 1 && (
            <div className="pb-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Total</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    <span className="font-semibold">{totalUsed}</span>
                    <span className="text-muted-foreground">/{totalQuota}</span>
                  </span>
                  {totalPercentage >= WARNING_THRESHOLD && (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </div>
              <Progress
                value={totalPercentage}
                className={cn(totalPercentage >= WARNING_THRESHOLD && '[&>div]:bg-amber-500')}
              />
            </div>
          )}

          {/* Individual Features */}
          {features.map((feature) => {
            const percentage = feature.quota > 0 ? (feature.used / feature.quota) * 100 : 0;
            const isNearLimit = percentage >= WARNING_THRESHOLD;

            return (
              <div key={feature.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{feature.name}</span>
                  <div className="flex items-center gap-2">
                    {feature.trend && (
                      <div
                        className={cn(
                          'flex items-center text-xs',
                          feature.trend === 'up' && 'text-green-600',
                          feature.trend === 'down' && 'text-red-600',
                          feature.trend === 'stable' && 'text-muted-foreground'
                        )}
                      >
                        {feature.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                        {feature.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                        {feature.trend === 'stable' && <Minus className="h-3 w-3" />}
                      </div>
                    )}
                    <span className="text-sm">
                      <span className="font-medium">{feature.used}</span>
                      <span className="text-muted-foreground">/{feature.quota}</span>
                    </span>
                    {isNearLimit && (
                      <Badge variant="destructive" className="text-xs py-0">
                        {percentage.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className={cn(
                    'h-2',
                    isNearLimit && '[&>div]:bg-destructive'
                  )}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
