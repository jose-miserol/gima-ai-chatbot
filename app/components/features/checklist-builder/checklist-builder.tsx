/**
 * ChecklistBuilder - Componente principal
 *
 * Orquesta la generación de checklists de mantenimiento con IA.
 * Combina formulario, preview y lista de templates.
 */

'use client';

import { useState } from 'react';

import { ChecklistBuilderForm } from './checklist-builder-form';
import { ChecklistBuilderList } from './checklist-builder-list';
import { ChecklistBuilderPreview } from './checklist-builder-preview';

import type { Checklist } from './types';

/**
 *
 */
export function ChecklistBuilder() {
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [view, setView] = useState<'form' | 'preview' | 'templates'>('form');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Smart Checklist Builder</h1>
        <p className="text-muted-foreground">
          Genera checklists de mantenimiento personalizados con IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de generación */}
        <div className="lg:col-span-2">
          <ChecklistBuilderForm
            onChecklistGenerated={(checklist) => {
              setActiveChecklist(checklist);
              setView('preview');
            }}
          />
        </div>

        {/* Panel lateral - Templates */}
        <div>
          <ChecklistBuilderList
            onTemplateSelected={(template) => {
              setActiveChecklist(template.checklist);
              setView('preview');
            }}
          />
        </div>
      </div>

      {/* Preview modal/drawer */}
      {activeChecklist && view === 'preview' && (
        <ChecklistBuilderPreview
          checklist={activeChecklist}
          onClose={() => setView('form')}
          onSave={(checklist) => {
            // TODO: Implementar guardado
            console.log('Saving checklist:', checklist);
          }}
        />
      )}
    </div>
  );
}
