/**
 * Activity Summary Schemas - Validación con Zod
 *
 * Schemas para validar requests y responses de generación
 * de resúmenes de actividades con IA.
 */

import { z } from 'zod';

/**
 * Estilos de resumen válidos
 */
const summaryStyleEnum = z.enum(['ejecutivo', 'tecnico', 'narrativo']);

/**
 * Niveles de detalle válidos
 */
const detailLevelEnum = z.enum(['alto', 'medio', 'bajo']);

/**
 * Schema para request de generación de resumen
 */
export const activitySummaryRequestSchema = z.object({
  /**
   * Tipo de activo
   */
  assetType: z.string().min(1, 'Tipo de activo requerido'),

  /**
   * Tipo de tarea
   */
  taskType: z.string().min(1, 'Tipo de tarea requerido'),

  /**
   * Actividades realizadas
   */
  activities: z
    .string()
    .min(50, 'Las actividades deben tener al menos 50 caracteres')
    .max(5000, 'Las actividades no pueden exceder 5000 caracteres'),

  /**
   * Estilo del resumen
   */
  style: summaryStyleEnum,

  /**
   * Nivel de detalle
   */
  detailLevel: detailLevelEnum,

  /**
   * Contexto adicional (opcional)
   */
  context: z.string().max(500, 'El contexto no puede exceder 500 caracteres').optional(),
});

/**
 * Schema para sección de resumen
 */
export const summarySectionSchema = z.object({
  /**
   * Título de la sección
   */
  title: z.string().min(1, 'Título de sección requerido').max(100),

  /**
   * Contenido de la sección
   */
  content: z.string().min(1, 'Contenido de sección requerido'),

  /**
   * Orden de la sección
   */
  order: z.number().int().min(0),
});

/**
 * Schema para resumen completo de actividad
 */
export const activitySummarySchema = z.object({
  /**
   * ID único
   */
  id: z.string().uuid(),

  /**
   * Título del resumen
   */
  title: z.string().min(1).max(150),

  /**
   * Resumen ejecutivo
   */
  executive: z.string().min(50).max(1000),

  /**
   * Secciones del resumen
   */
  sections: z.array(summarySectionSchema).min(1).max(10),

  /**
   * Tipo de activo
   */
  assetType: z.string(),

  /**
   * Tipo de tarea
   */
  taskType: z.string(),

  /**
   * Estilo usado
   */
  style: summaryStyleEnum,

  /**
   * Nivel de detalle
   */
  detailLevel: detailLevelEnum,

  /**
   * Fecha de creación
   */
  createdAt: z.date(),

  /**
   * Metadata opcional
   */
  metadata: z
    .object({
      wordCount: z.number().int().positive().optional(),
      readingTime: z.number().int().positive().optional(),
      generatedBy: z.enum(['ai', 'manual']).optional(),
      version: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema para respuesta de IA (antes de procesar)
 */
export const aiSummaryResponseSchema = z.object({
  /**
   * Título del resumen
   */
  title: z.string().min(1).max(150),

  /**
   * Resumen ejecutivo
   */
  executive: z.string().min(50).max(1000),

  /**
   * Secciones del resumen
   */
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(1),
        order: z.number().int().min(0),
      })
    )
    .min(1)
    .max(10),
});

/**
 * Tipos inferidos de los schemas
 */
export type ActivitySummaryRequest = z.infer<typeof activitySummaryRequestSchema>;
export type SummarySection = z.infer<typeof summarySectionSchema>;
export type ActivitySummary = z.infer<typeof activitySummarySchema>;
export type AISummaryResponse = z.infer<typeof aiSummaryResponseSchema>;
