/**
 * ChecklistBuilderList - Lista de templates guardados
 *
 * Muestra los checklists guardados como templates.
 * Permite seleccionar y cargar templates existentes.
 */

'use client';

import { useState } from 'react';

import { Button } from '@/app/components/ui/button';

import type { Checklist } from './types';

interface ChecklistTemplate {
  id: string;
  name: string;
  checklist: Checklist;
  createdAt: Date;
}

interface ChecklistBuilderListProps {
  /**
   * Callback al seleccionar un template
   */
  onTemplateSelected: (template: ChecklistTemplate) => void;
}

/**
 * Lista de templates de checklist guardados
 * @param root0
 * @param root0.onTemplateSelected
 */
export function ChecklistBuilderList({ onTemplateSelected }: ChecklistBuilderListProps) {
  // TODO: Cargar templates desde localStorage o API
  const [templates] = useState<ChecklistTemplate[]>([]);

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Templates Guardados</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No hay templates guardados</p>
          <p className="text-xs mt-2">
            Genera un checklist y guárdalo como template para verlo aquí
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold mb-4">Templates Guardados</h3>
      <div className="space-y-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border rounded-lg p-4 hover:bg-accent/50 transition cursor-pointer"
            onClick={() => onTemplateSelected(template)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onTemplateSelected(template);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {template.checklist.items.length} items •{' '}
                  {template.checklist.assetType}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                Usar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
