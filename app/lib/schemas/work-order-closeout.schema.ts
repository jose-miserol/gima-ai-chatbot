/**
 * Work Order Closeout Schemas - Validación con Zod
 *
 * Schemas para validar requests y responses de generación
 * de notas de cierre con IA.
 */

import { z } from 'zod';

/**
 * Estilos de notas válidos
 */
const closeoutStyleEnum = z.enum(['formal', 'technical', 'brief']);

/**
 * Schema para resumen de Work Order
 */
export const workOrderSummarySchema = z.object({
  /**
   * ID del work order
   */
  id: z.string().min(1),

  /**
   * Título del trabajo
   */
  title: z.string().min(1).max(200),

  /**
   * Descripción
   */
  description: z.string().min(1).max(1000),

  /**
   * Tipo de activo
   */
  assetType: z.string().min(1),

  /**
   * Tipo de tarea
   */
  taskType: z.string().min(1),

  /**
   * Prioridad
   */
  priority: z.string().min(1),

  /**
   * Actividades realizadas
   */
  activities: z.array(z.string().min(1)).min(1),

  /**
   * Materiales usados (opcional)
   */
  materialsUsed: z.array(z.string()).optional(),

  /**
   * Tiempo invertido en horas
   */
  timeSpent: z.number().positive(),

  /**
   * Problemas encontrados (opcional)
   */
  issues: z.array(z.string()).optional(),
});

/**
 * Schema para request de generación de notas
 */
export const closeoutNotesRequestSchema = z.object({
  /**
   * ID del work order
   */
  workOrderId: z.string().min(1),

  /**
   * Datos del work order
   */
  workOrderData: workOrderSummarySchema,

  /**
   * Estilo de las notas
   */
  style: closeoutStyleEnum,

  /**
   * Incluir recomendaciones
   */
  includeRecommendations: z.boolean().default(true),
});

/**
 * Schema para notas de cierre generadas (response de IA)
 */
export const aiCloseoutNotesSchema = z.object({
  /**
   * Resumen ejecutivo
   */
  summary: z.string().min(50).max(500),

  /**
   * Trabajo realizado
   */
  workPerformed: z.string().min(100).max(1000),

  /**
   * Hallazgos
   */
  findings: z.string().min(50).max(800),

  /**
   * Recomendaciones (opcional)
   */
  recommendations: z.string().max(500).optional(),

  /**
   * Materiales utilizados
   */
  materialsUsed: z.string().min(10).max(500),

  /**
   * Desglose de tiempo
   */
  timeBreakdown: z.string().min(20).max(300),

  /**
   * Próximas acciones (opcional)
   */
  nextActions: z.string().max(400).optional(),
});

/**
 * Schema para notas completas (con metadata)
 */
export const closeoutNotesSchema = z.object({
  /**
   * ID único
   */
  id: z.string().uuid(),

  /**
   * ID del work order
   */
  workOrderId: z.string(),

  /**
   * Resumen ejecutivo
   */
  summary: z.string(),

  /**
   * Trabajo realizado
   */
  workPerformed: z.string(),

  /**
   * Hallazgos
   */
  findings: z.string(),

  /**
   * Recomendaciones
   */
  recommendations: z.string().optional(),

  /**
   * Materiales utilizados
   */
  materialsUsed: z.string(),

  /**
   * Desglose de tiempo
   */
  timeBreakdown: z.string(),

  /**
   * Próximas acciones
   */
  nextActions: z.string().optional(),

  /**
   * Estilo usado
   */
  style: closeoutStyleEnum,

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
      generatedBy: z.enum(['ai', 'manual']).optional(),
      version: z.string().optional(),
    })
    .optional(),
});

/**
 * Tipos inferidos de los schemas
 */
export type WorkOrderSummary = z.infer<typeof workOrderSummarySchema>;
export type CloseoutNotesRequest = z.infer<typeof closeoutNotesRequestSchema>;
export type AICloseoutNotes = z.infer<typeof aiCloseoutNotesSchema>;
export type CloseoutNotes = z.infer<typeof closeoutNotesSchema>;
