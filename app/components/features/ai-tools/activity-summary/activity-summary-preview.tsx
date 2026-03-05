/**
 * ActivitySummaryPreview - Vista preview del resumen
 *
 * Muestra el resumen generado con capacidad de exportar.
 * Permite guardar como template o copiar al portapapeles.
 */

'use client';

import { Button } from '@/app/components/ui/button';

import type { ActivitySummary } from './types';

interface ActivitySummaryPreviewProps {
  /**
   * Resumen a mostrar
   */
  summary: ActivitySummary;

  /**
   * Callback al cerrar preview
   */
  onClose: () => void;

  /**
   * Callback al guardar resumen
   */
  onSave: (summary: ActivitySummary) => void;
}

/**
 *
 * @param root0
 * @param root0.summary
 * @param root0.onClose
 * @param root0.onSave
 */
export function ActivitySummaryPreview({ summary, onClose, onSave }: ActivitySummaryPreviewProps) {
  const readingTime = summary.metadata?.readingTime || 0;
  const wordCount = summary.metadata?.wordCount || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{summary.title}</h2>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{wordCount} palabras</span>
                <span>•</span>
                <span>{readingTime} min lectura</span>
                <span>•</span>
                <span className="capitalize">{summary.style}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Resumen Ejecutivo */}
        <div className="p-6 border-b bg-accent/20">
          <h3 className="font-semibold text-lg mb-3">Resumen Ejecutivo</h3>
          <p className="text-muted-foreground leading-relaxed">{summary.executive}</p>
        </div>

        {/* Secciones */}
        <div className="p-6 space-y-6">
          {summary.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <div key={section.order}>
                <h3 className="font-semibold text-lg mb-3">{section.title}</h3>
                <div
                  className="text-muted-foreground leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-card border-t p-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // TODO: Implementar copy to clipboard
              console.log('Copy to clipboard');
            }}
            className="flex-1"
          >
            Copiar
          </Button>
          <Button onClick={() => onSave(summary)} className="flex-1">
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
