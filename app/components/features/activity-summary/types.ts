/**
 * Tipos para Activity Summaries
 *
 * Re-exporta tipos del schema para mantener consistencia entre
 * cliente y servidor, similar al patrón de ChecklistBuilder.
 */

import type {
  ActivitySummaryRequest,
  ActivitySummary,
  SummarySection,
  AISummaryResponse,
} from '@/app/lib/schemas/activity-summary.schema';

// Re-exportar para compatibilidad
export type { ActivitySummaryRequest, ActivitySummary, SummarySection, AISummaryResponse };

/**
 * Estilos de resumen disponibles
 * (Mantener aquí porque son específicos de UI)
 */
export type SummaryStyle = 'ejecutivo' | 'tecnico' | 'narrativo';

/**
 * Niveles de detalle del resumen
 * (Mantener aquí porque son específicos de UI)
 */
export type DetailLevel = 'alto' | 'medio' | 'bajo';

/**
 * Template de resumen guardado
 * (Específico de UI, no validado por Zod)
 */
export interface SummaryTemplate {
  /**
   * ID del template
   */
  id: string;

  /**
   * Nombre del template
   */
  name: string;

  /**
   * Resumen asociado
   */
  summary: ActivitySummary;

  /**
   * Número de veces usado
   */
  usageCount: number;

  /**
   * Fecha de última modificación
   */
  updatedAt: Date;
}

/**
 * Estado del hook de generación
 * (Específico de UI, manejo de estado del componente)
 */
export interface SummaryGenerationState {
  /**
   * Si está generando actualmente
   */
  isGenerating: boolean;

  /**
   * Resumen generado
   */
  summary: ActivitySummary | null;

  /**
   * Error si la generación falló
   */
  error: Error | null;

  /**
   * Progreso de generación (0-100)
   */
  progress: number;
}
