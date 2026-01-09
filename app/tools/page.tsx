/**
 * AI Tools Dashboard Page
 *
 * Landing page que muestra todas las herramientas AI disponibles.
 */

import { AIToolsDashboardClient } from '@/app/components/features/ai-tools/dashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Tools | GIMA AI',
  description: 'Herramientas de inteligencia artificial para mantenimiento',
};

/**
 *
 */
export default function AIToolsPage() {
  return <AIToolsDashboardClient />;
}
