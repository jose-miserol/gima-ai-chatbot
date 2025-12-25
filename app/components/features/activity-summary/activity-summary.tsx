/**
 * ActivitySummary - Componente principal
 *
 * Orquesta la generación de resúmenes de actividades con IA.
 * Combina formulario, preview y lista de templates.
 */

'use client';

import { useState } from 'react';
import { ActivitySummaryForm } from './activity-summary-form';
import { ActivitySummaryPreview } from './activity-summary-preview';
import { ActivitySummaryList } from './activity-summary-list';
import type { ActivitySummary as Summary } from './types';

export function ActivitySummary() {
  const [activeSummary, setActiveSummary] = useState<Summary | null>(null);
  const [view, setView] = useState<'form' | 'preview' | 'templates'>('form');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Activity Summaries</h1>
        <p className="text-muted-foreground">
          Genera resúmenes profesionales de actividades de mantenimiento con IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de generación */}
        <div className="lg:col-span-2">
          <ActivitySummaryForm
            onSummaryGenerated={(summary) => {
              setActiveSummary(summary);
              setView('preview');
            }}
          />
        </div>

        {/* Panel lateral - Templates */}
        <div>
          <ActivitySummaryList
            onTemplateSelected={(template) => {
              setActiveSummary(template.summary);
              setView('preview');
            }}
          />
        </div>
      </div>

      {/* Preview modal/drawer */}
      {activeSummary && view === 'preview' && (
        <ActivitySummaryPreview
          summary={activeSummary}
          onClose={() => setView('form')}
          onSave={(summary) => {
            // TODO: Implementar guardado
            console.log('Saving summary:', summary);
          }}
        />
      )}
    </div>
  );
}
