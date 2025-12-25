/**
 * AIPreviewCard - Card de preview estándar para contenido generado por IA
 *
 * Muestra contenido generado con metadata y acciones (Accept, Reject, Regenerate).
 */

'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Edit } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import type { AIPreviewActions, AIGenerationMetadata } from './types';
import type { ReactNode } from 'react';

/**
 * Props para AIPreviewCard
 */
export interface AIPreviewCardProps {
  /**
   * Título del preview
   */
  title: string;

  /**
   * Contenido a mostrar
   */
  content: string | ReactNode;

  /**
   * Metadata de generación
   */
  metadata?: AIGenerationMetadata;

  /**
   * Acciones disponibles
   */
  actions: AIPreviewActions;

  /**
   * Estado de carga
   */
  isLoading?: boolean;

  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Card de preview con actions para contenido generado
 */
export function AIPreviewCard({
  title,
  content,
  metadata,
  actions,
  isLoading = false,
  className,
}: AIPreviewCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {metadata?.cached && (
            <Badge variant="secondary" className="gap-1">
              Cached
            </Badge>
          )}
        </div>

        {/* Metadata badges */}
        {metadata && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {metadata.wordCount && (
              <Badge variant="outline" className="text-xs">
                {metadata.wordCount} palabras
              </Badge>
            )}
            {metadata.duration && (
              <Badge variant="outline" className="text-xs">
                {(metadata.duration / 1000).toFixed(1)}s
              </Badge>
            )}
            {metadata.model && (
              <Badge variant="outline" className="text-xs">
                {metadata.model}
              </Badge>
            )}
            {metadata.confidence !== undefined && (
              <Badge
                variant={metadata.confidence > 0.8 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {(metadata.confidence * 100).toFixed(0)}% confianza
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {typeof content === 'string' ? <p className="whitespace-pre-wrap">{content}</p> : content}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 flex-wrap">
        <Button onClick={actions.onAccept} size="sm" className="gap-2">
          <CheckCircle className="h-4 w-4" />
          Aceptar
        </Button>

        <Button onClick={actions.onReject} variant="outline" size="sm" className="gap-2">
          <XCircle className="h-4 w-4" />
          Rechazar
        </Button>

        {actions.onRegenerate && (
          <Button onClick={actions.onRegenerate} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </Button>
        )}

        {actions.onEdit && (
          <Button onClick={actions.onEdit} variant="ghost" size="sm" className="gap-2">
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
