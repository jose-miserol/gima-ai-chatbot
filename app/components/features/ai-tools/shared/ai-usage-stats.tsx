/**
 * AIUsageStats - Métricas de uso de AI features
 *
 * Muestra estadísticas básicas de uso almacenadas en localStorage.
 */

'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { TrendingUp, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Props para AIUsageStats
 */
export interface AIUsageStatsProps {
  /**
   * Nombre de la feature
   */
  feature: string;
}

/**
 * Stats de uso para display
 */
interface UsageStats {
  used: number;
  quota: number;
  trend: string;
}

/**
 * Componente de estadísticas de uso
 */
export function AIUsageStats({ feature }: AIUsageStatsProps) {
  const [stats, setStats] = useState<UsageStats>({ used: 0, quota: 100, trend: '+0%' });

  useEffect(() => {
    const stored = localStorage.getItem(`ai-usage-${feature}`);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      // Safe: localStorage is external data, setState only happens once on mount per feature
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats(parsed);
    } catch {
      // Ignore parse errors - keep default stats
    }
  }, [feature]);

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Usage this month</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-semibold">{stats.used}</span>
              <span className="text-muted-foreground">/{stats.quota}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <TrendingUp className="h-3 w-3" />
              {stats.trend}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
