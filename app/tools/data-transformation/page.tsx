/**
 * Data Transformation Page
 *
 * Página de la herramienta de transformación de datos con IA.
 */

import type { Metadata } from 'next';

import { DataTransformation } from '@/app/components/features/data-transformation/data-transformation';

export const metadata: Metadata = {
  title: 'Data Transformation | GIMA AI',
  description: 'Transforma y limpia datos usando instrucciones en lenguaje natural',
};

/**
 * Data Transformation Page Component
 *
 * @returns Server component that renders the client
 */
export default function DataTransformationPage() {
  return <DataTransformation />;
}
