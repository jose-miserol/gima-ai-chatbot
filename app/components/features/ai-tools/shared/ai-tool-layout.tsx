/**
 * AIToolLayout - Layout consistente para páginas de AI tools
 *
 * Proporciona estructura común con header, stats y content area.
 */

'use client';

import { Badge } from '@/app/components/ui/badge';
import type { ReactNode } from 'react';

/**
 * Props para AIToolLayout
 */
export interface AIToolLayoutProps {
  /**
   * Título de la herramienta
   */
  title: string;

  /**
   * Descripción breve
   */
  description: string;

  /**
   * Icono de la herramienta
   */
  icon?: ReactNode;

  /**
   * Contenido principal
   */
  children: ReactNode;

  /**
   * Acciones flotantes (opcional)
   */
  actions?: ReactNode;

  /**
   * Mostrar badge "AI-Powered"
   */
  showAIBadge?: boolean;
}

/**
 * Layout estándar para AI tool pages
 */
export function AIToolLayout({
  title,
  description,
  icon,
  children,
  actions,
  showAIBadge = true,
}: AIToolLayoutProps) {
  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {icon && <div className="text-primary">{icon}</div>}
          <h1 className="text-3xl font-bold">{title}</h1>
          {showAIBadge && (
            <Badge variant="secondary" className="ml-2">
              AI-Powered
            </Badge>
          )}
        </div>
        <p className="text-lg text-muted-foreground">{description}</p>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">{children}</div>

      {/* Floating Actions */}
      {actions && <div className="fixed bottom-6 right-6 z-50">{actions}</div>}
    </div>
  );
}
