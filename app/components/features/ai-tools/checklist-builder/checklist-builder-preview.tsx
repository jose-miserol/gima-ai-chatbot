/**
 * ChecklistBuilderPreview - Vista preview del checklist
 *
 * Muestra el checklist generado con capacidad de edición.
 * Permite guardar como template o exportar.
 */

'use client';

import { Button } from '@/app/components/ui/button';

import type { Checklist } from './types';

interface ChecklistBuilderPreviewProps {
  /**
   * Checklist a mostrar
   */
  checklist: Checklist;

  /**
   * Callback al cerrar preview
   */
  onClose: () => void;

  /**
   * Callback al guardar checklist
   */
  onSave: (checklist: Checklist) => void;
}

/**
 *
 * @param root0
 * @param root0.checklist
 * @param root0.onClose
 * @param root0.onSave
 */
export function ChecklistBuilderPreview({
  checklist,
  onClose,
  onSave,
}: ChecklistBuilderPreviewProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{checklist.title}</h2>
              <p className="text-muted-foreground mt-1">{checklist.description}</p>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="p-6 space-y-4">
          {checklist.items.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-4 hover:bg-accent/50 transition">
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground font-mono text-sm">{index + 1}.</span>
                <div className="flex-1">
                  <p className="font-medium">{item.description}</p>
                  {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                      {item.category}
                    </span>
                    {item.required && (
                      <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500">
                        Obligatorio
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-card border-t p-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button onClick={() => onSave(checklist)} className="flex-1">
            Guardar como Template
          </Button>
        </div>
      </div>
    </div>
  );
}
