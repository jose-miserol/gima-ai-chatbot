/**
 * ActivitySummaryList - Lista de templates guardados
 *
 * Muestra templates de resúmenes guardados previamente.
 * Permite seleccionar, editar y eliminar templates.
 */

'use client';

import { Button } from '@/app/components/ui/button';
import { SUMMARY_MESSAGES } from './constants';
import { useSummaryTemplates } from './hooks';
import type { SummaryTemplate } from './types';

interface ActivitySummaryListProps {
  /**
   * Callback cuando se selecciona un template
   */
  onTemplateSelected: (template: SummaryTemplate) => void;
}

export function ActivitySummaryList({ onTemplateSelected }: ActivitySummaryListProps) {
  const { templates, isLoading } = useSummaryTemplates();

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Resúmenes Guardados</h2>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando resúmenes...</p>}

      {!isLoading && templates.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">{SUMMARY_MESSAGES.NO_TEMPLATES}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Genera un resumen y guárdalo para usarlo después
          </p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition cursor-pointer"
              onClick={() => onTemplateSelected(template)}
            >
              <h3 className="font-medium">{template.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {template.summary.style} • {template.summary.detailLevel}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Usado {template.usageCount} {template.usageCount === 1 ? 'vez' : 'veces'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
