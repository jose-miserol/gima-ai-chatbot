/**
 * Checklist Builder Page
 *
 * Página principal para generar checklists de mantenimiento con IA.
 * Usa componentes shared de ai-tools.
 */

import { ChecklistBuilderClient } from './checklist-builder-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checklist Builder | GIMA AI',
  description: 'Genera checklists de mantenimiento con inteligencia artificial',
};

export default function ChecklistBuilderPage() {
  return <ChecklistBuilderClient />;
}
