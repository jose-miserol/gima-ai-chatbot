/**
 * AIToolLayout - Layout consistente para páginas de AI tools
 *
 * Proporciona estructura común con header, breadcrumbs, stats, y content area.
 * Incluye soporte para accesibilidad (landmarks) y floating actions via portal.
 */

'use client';

import { Suspense, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { ChevronRight, HelpCircle, Sparkles, Home } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Estadísticas de uso para el layout
 */
export interface AIToolStats {
  /** Cantidad usada este mes */
  used: number;
  /** Cuota máxima */
  quota: number;
  /** Fecha de reset */
  resetDate?: Date;
  /** Costo estimado formateado (opcional) */
  costEstimate?: string;
}

/**
 * Item de breadcrumb
 */
export interface BreadcrumbItem {
  /** Texto a mostrar */
  label: string;
  /** URL del enlace (opcional, si no hay es el item actual) */
  href?: string;
}

/**
 * Props para AIToolLayout
 */
export interface AIToolLayoutProps {
  /** Título de la herramienta */
  title: string;
  /** Descripción breve */
  description: string;
  /** Icono de la herramienta */
  icon?: ReactNode;
  /** Contenido principal */
  children: ReactNode;
  /** Acciones flotantes (opcional) */
  actions?: ReactNode;
  /** Mostrar badge "AI-Powered" */
  showAIBadge?: boolean;
  /** Estadísticas de uso (opcional) */
  stats?: AIToolStats;
  /** Contenido del tooltip de ayuda (opcional) */
  helpContent?: ReactNode;
  /** Breadcrumbs (opcional, se auto-genera si no se provee) */
  breadcrumbs?: BreadcrumbItem[];
}

/**
 * Componente interno para stats con progress bar
 */
function StatsBar({ stats }: { stats: AIToolStats }) {
  const percentage = Math.min((stats.used / stats.quota) * 100, 100);
  const isNearLimit = percentage >= 80;
  const daysUntilReset = stats.resetDate
    ? Math.ceil((stats.resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-muted/50 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Uso este mes</span>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            <span className="font-semibold">{stats.used}</span>
            <span className="text-muted-foreground">/{stats.quota}</span>
          </span>
          {isNearLimit && (
            <Badge variant="destructive" className="text-xs">
              Cerca del límite
            </Badge>
          )}
        </div>
      </div>
      <Progress
        value={percentage}
        className={isNearLimit ? '[&>div]:bg-destructive' : ''}
      />
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        {daysUntilReset !== null && (
          <span>Se reinicia en {daysUntilReset} días</span>
        )}
        {stats.costEstimate !== undefined && (
          <span>Costo estimado: {stats.costEstimate}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Componente interno para breadcrumbs
 */
function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        <li>
          <Link
            href="/tools"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
            <span>AI Tools</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Componente para floating actions con portal
 */
function FloatingActions({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {children}
    </div>,
    document.body
  );
}

/**
 * Layout estándar para AI tool pages
 *
 * Proporciona:
 * - Header con título, descripción, icono y badge AI-Powered
 * - Breadcrumbs para navegación
 * - Barra de estadísticas de uso con progress visual
 * - Grid responsive (1 col mobile, 2 cols desktop)
 * - Floating actions via portal
 * - Help tooltip con contenido personalizado
 * - Semantic HTML con landmarks para accesibilidad
 */
export function AIToolLayout({
  title,
  description,
  icon,
  children,
  actions,
  showAIBadge = true,
  stats,
  helpContent,
  breadcrumbs = [{ label: title }],
}: AIToolLayoutProps) {
  return (
    <TooltipProvider>
      <div className="container mx-auto py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {icon && (
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {icon}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold">{title}</h1>
                {showAIBadge && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI-Powered
                  </Badge>
                )}
                {helpContent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Ayuda"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      {helpContent}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-lg text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        {stats && (
          <Suspense fallback={<div className="h-24 bg-muted/50 rounded-lg animate-pulse mb-6" />}>
            <StatsBar stats={stats} />
          </Suspense>
        )}

        {/* Main Content Grid */}
        <main className="grid lg:grid-cols-2 gap-6" role="main">
          {children}
        </main>

        {/* Floating Actions (via portal) */}
        {actions && <FloatingActions>{actions}</FloatingActions>}
      </div>
    </TooltipProvider>
  );
}
