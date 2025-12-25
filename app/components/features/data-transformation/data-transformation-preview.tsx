'use client';

import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Badge } from '@/app/components/ui/badge';
import { Check, X } from 'lucide-react';
import type { TransformationResult } from './types';

/**
 * Props para DataTransformationPreview
 */
interface DataTransformationPreviewProps {
  /** Datos originales sin modificar */
  originalData: string;
  /** Resultado de la transformación */
  result: TransformationResult;
  /** Callback al aceptar cambios */
  onApply: () => void;
  /** Callback al rechazar cambios */
  onReject: () => void;
  /** Estado de carga al aplicar */
  isApplying?: boolean;
}

/**
 * Vista previa de Data Transformation
 *
 * Muestra una comparación side-by-side de los datos originales y transformados.
 * Incluye métricas (tamaño, items procesados) y botones de acción.
 */
export function DataTransformationPreview({
  originalData,
  result,
  onApply,
  onReject,
  isApplying = false,
}: DataTransformationPreviewProps) {
  const originalSize = new Blob([originalData]).size;
  const resultDataString =
    typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
  const resultSize = new Blob([resultDataString]).size;

  return (
    <div className="space-y-4 border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Vista Previa de Transformación</h3>
        <div className="flex gap-2">
          <Badge variant="outline">
            {result.stats.itemsProcessed ? `${result.stats.itemsProcessed} items` : 'Procesado'}
          </Badge>
          <Badge variant={resultSize < originalSize ? 'default' : 'secondary'}>
            {Math.round((resultSize / 1024) * 100) / 100} KB
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[500px]">
        {/* Original */}
        <div className="flex flex-col gap-2 h-full">
          <span className="text-xs font-medium text-muted-foreground uppercase">Original</span>
          <div className="border rounded-md bg-muted/50 flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4 font-mono text-xs">
              <pre className="whitespace-pre-wrap break-all">{originalData}</pre>
            </ScrollArea>
          </div>
        </div>

        {/* Result */}
        <div className="flex flex-col gap-2 h-full">
          <span className="text-xs font-medium text-muted-foreground uppercase">Resultado</span>
          <div className="border rounded-md bg-background flex-1 overflow-hidden border-green-200 dark:border-green-900 ring-1 ring-green-100 dark:ring-green-900/20">
            <ScrollArea className="h-full p-4 font-mono text-xs">
              <pre className="whitespace-pre-wrap break-all">{resultDataString}</pre>
            </ScrollArea>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <div className="text-sm text-muted-foreground mr-auto">
          Duración: {result.stats.durationMs}ms
        </div>
        <Button variant="outline" onClick={onReject} disabled={isApplying}>
          <X className="mr-2 h-4 w-4" />
          Descartar
        </Button>
        <Button onClick={onApply} disabled={isApplying}>
          <Check className="mr-2 h-4 w-4" />
          {isApplying ? 'Aplicando...' : 'Aplicar Transformación'}
        </Button>
      </div>
    </div>
  );
}
