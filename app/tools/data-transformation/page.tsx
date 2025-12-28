/**
 * Data Transformation Page
 *
 * Página de la herramienta de transformación de datos con IA.
 */

import { DataTransformation } from '@/app/components/features/data-transformation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Transformation | GIMA AI',
  description: 'Transforma y limpia datos usando instrucciones en lenguaje natural',
};

/**
 *
 */
export default function DataTransformationPage() {
  return (
    <div className="container mx-auto py-8">
      <DataTransformation />
    </div>
  );
}
