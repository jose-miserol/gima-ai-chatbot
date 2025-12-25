/**
 * Tipos para Activity Summaries
 *
 * Define interfaces para resúmenes de actividades de mantenimiento
 * generados con IA.
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

/**
 * Estilos de resumen disponibles
 */
export type SummaryStyle = 'ejecutivo' | 'tecnico' | 'narrativo';

/**
 * Niveles de detalle del resumen
 */
export type DetailLevel = 'alto' | 'medio' | 'bajo';

/**
 * Request para generar resumen de actividades
 */
export interface ActivitySummaryRequest {
  /**
   * Tipo de activo
   */
  assetType: AssetType;

  /**
   * Tipo de tarea
   */
  taskType: TaskType;

  /**
   * Actividades completadas (texto libre)
   */
  activities: string;

  /**
   * Estilo del resumen
   */
  style: SummaryStyle;

  /**
   * Nivel de detalle
   */
  detailLevel: DetailLevel;

  /**
   * Contexto adicional (opcional)
   */
  context?: string;
}

/**
 * Sección de un resumen
 */
export interface SummarySection {
  /**
   * Título de la sección
   */
  title: string;

  /**
   * Contenido de la sección
   */
  content: string;

  /**
   * Orden de la sección
   */
  order: number;
}

/**
 * Resumen de actividad completo
 */
export interface ActivitySummary {
  /**
   * ID único del resumen
   */
  id: string;

  /**
   * Título del resumen
   */
  title: string;

  /**
   * Resumen ejecutivo (1-2 párrafos)
   */
  executive: string;

  /**
   * Secciones del resumen
   */
  sections: SummarySection[];

  /**
   * Tipo de activo
   */
  assetType: AssetType;

  /**
   * Tipo de tarea
   */
  taskType: TaskType;

  /**
   * Estilo usado
   */
  style: SummaryStyle;

  /**
   * Nivel de detalle
   */
  detailLevel: DetailLevel;

  /**
   * Fecha de creación
   */
  createdAt: Date;

  /**
   * Metadata adicional
   */
  metadata?: {
    wordCount?: number;
    readingTime?: number; // minutos
    generatedBy?: 'ai' | 'manual';
    version?: string;
  };
}

/**
 * Template de resumen guardado
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
