/**
 * Activity Summaries Page
 *
 * Página principal para generar resúmenes de actividades con IA.
 * Usa componentes shared de ai-tools.
 */

import { ActivitySummary } from '@/app/components/features/ai-tools/activity-summary/activity-summary';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resúmenes de Actividad | GIMA',
  description: 'Genera resúmenes profesionales de actividades de mantenimiento',
};

/**
 *
 */
export default function ActivitySummariesPage() {
  return <ActivitySummary />;
}
