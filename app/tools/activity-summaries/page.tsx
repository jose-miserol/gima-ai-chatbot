/**
 * Activity Summaries Page
 *
 * Página principal para generar resúmenes de actividades con IA.
 * Usa componentes shared de ai-tools.
 */

import { ActivitySummariesClient } from './activity-summaries-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activity Summaries | GIMA AI',
  description: 'Genera resúmenes profesionales de actividades de mantenimiento',
};

export default function ActivitySummariesPage() {
  return <ActivitySummariesClient />;
}
