/**
 * AIPreviewCard - Card de preview estándar para contenido generado por IA
 *
 * Muestra contenido generado con metadata y acciones (Accept, Reject, Regenerate, Copy, Export).
 * Incluye soporte para accesibilidad con aria-live para anunciar cambios.
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Edit,
  Copy,
  Check,
  ChevronDown,
  Download,
  FileJson,
  FileText,
} from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/app/lib/utils';
import type { AIPreviewActions, AIGenerationMetadata } from './types';
import type { ReactNode } from 'react';

/**
 * Props para AIPreviewCard
 */
export interface AIPreviewCardProps {
  /** Título del preview */
  title: string;
  /** Contenido a mostrar */
  content: string | ReactNode;
  /** Metadata de generación */
  metadata?: AIGenerationMetadata;
  /** Acciones disponibles */
  actions: AIPreviewActions;
  /** Estado de carga */
  isLoading?: boolean;
  /** Clase CSS adicional */
  className?: string;
  /** Callback para copiar (si se necesita custom logic) */
  onCopy?: () => void;
  /** Callback para exportar como JSON */
  onExportJson?: () => void;
  /** Callback para exportar como Markdown */
  onExportMarkdown?: () => void;
  /** Datos para exportar (si content es ReactNode) */
  exportData?: Record<string, unknown>;
}

/**
 * Card de preview con actions para contenido generado
 *
 * Features:
 * - Copy to clipboard con feedback visual
 * - Export como JSON o Markdown
 * - Metadata collapsible
 * - aria-live para accesibilidad
 * - Skeleton loader durante carga
 */
export function AIPreviewCard({
  title,
  content,
  metadata,
  actions,
  isLoading = false,
  className,
  onCopy,
  onExportJson,
  onExportMarkdown,
  exportData,
}: AIPreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  // Copiar al clipboard
  const handleCopy = useCallback(async () => {
    if (onCopy) {
      onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    try {
      const textToCopy = typeof content === 'string' ? content : JSON.stringify(exportData, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  }, [content, exportData, onCopy]);

  // Export como JSON
  const handleExportJson = useCallback(() => {
    if (onExportJson) {
      onExportJson();
      return;
    }

    const data = exportData || { title, content: typeof content === 'string' ? content : null, metadata };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title, content, metadata, exportData, onExportJson]);

  // Export como Markdown
  const handleExportMarkdown = useCallback(() => {
    if (onExportMarkdown) {
      onExportMarkdown();
      return;
    }

    const textContent = typeof content === 'string' ? content : JSON.stringify(exportData, null, 2);
    const markdownContent = `# ${title}\n\n${textContent}\n\n---\n_Generado el ${new Date().toLocaleString('es-ES')}_`;
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [title, content, exportData, onExportMarkdown]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-24" />
        </CardFooter>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn('', className)} aria-live="polite">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {metadata?.cached && (
                <Badge variant="secondary" className="text-xs">
                  Cached
                </Badge>
              )}
              {/* Copy button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleCopy}
                    disabled={!content}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copiado!' : 'Copiar al portapapeles'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Metadata collapsible */}
          {metadata && (
            <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground hover:text-foreground">
                  <span className="text-xs">Ver detalles</span>
                  <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', metadataOpen && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {metadata.wordCount !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      {metadata.wordCount} palabras
                    </Badge>
                  )}
                  {metadata.duration !== undefined && (
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
                  {metadata.generatedAt && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(metadata.generatedAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Badge>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardHeader>

        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {typeof content === 'string' ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              content
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {/* Primary actions */}
          <div className="flex gap-2 flex-wrap w-full">
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
          </div>

          {/* Export actions */}
          <div className="flex gap-2 w-full border-t pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportJson}
                  className="gap-2"
                >
                  <FileJson className="h-4 w-4" />
                  <span className="hidden sm:inline">JSON</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar como JSON</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportMarkdown}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Markdown</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar como Markdown</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 ml-auto"
                  onClick={handleCopy}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Copiar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar al portapapeles</TooltipContent>
            </Tooltip>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
