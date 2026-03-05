/**
 * Checklist Builder Page
 *
 * Página principal para generar checklists de mantenimiento con IA.
 * Usa componentes shared de ai-tools.
 */

import { ChecklistBuilder } from '@/app/components/features/ai-tools/checklist-builder/checklist-builder';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checklist Builder | GIMA AI',
  description: 'Genera checklists de mantenimiento con inteligencia artificial',
};

/**
 *
 */
export default function ChecklistBuilderPage() {
  return <ChecklistBuilder />;
}
