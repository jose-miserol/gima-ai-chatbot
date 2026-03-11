/**
 * @file work-order-closeout.schema.ts
 * @module app/lib/schemas/work-order-closeout.schema
 *
 * ============================================================
 * SCHEMAS ZOD — NOTAS DE CIERRE DE ÓRDENES DE TRABAJO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod para todas las estructuras involucradas en la
 *   generación de notas de cierre de Órdenes de Trabajo (OT):
 *     - `workOrderSummarySchema`      → Valida los datos de la OT usados como contexto.
 *     - `closeoutNotesRequestSchema`  → Valida el request completo de generación.
 *     - `aiCloseoutNotesSchema`       → Valida la respuesta cruda del LLM.
 *     - `closeoutNotesSchema`         → Valida las notas completas almacenadas.
 *
 * CONTEXTO EN GIMA:
 *   El proceso de cierre de una OT requiere documentación formal: qué se hizo,
 *   qué se encontró, qué materiales se usaron y qué sigue después. Este módulo
 *   define el contrato de datos para ese proceso, desde los datos crudos de la
 *   OT hasta el documento final generado por la IA.
 *
 * RELACIÓN ENTRE SCHEMAS:
 *   workOrderSummarySchema          → Datos de la OT (actividades, materiales, tiempo)
 *         ↓ (embebido en closeoutNotesRequestSchema)
 *   closeoutNotesRequestSchema      → Request completo (OT + estilo + flags)
 *         ↓ (pasa a WorkOrderCloseoutAIService)
 *   aiCloseoutNotesSchema           → Formato mínimo esperado del LLM
 *         ↓ (enriquecido con UUID, timestamps, metadata)
 *   closeoutNotesSchema             → Notas completas almacenadas y retornadas a la UI
 *
 * DIFERENCIA ENTRE aiCloseoutNotesSchema Y closeoutNotesSchema:
 *   `aiCloseoutNotesSchema` define lo que el LLM debe retornar: tiene restricciones
 *   de longitud mínima (garantizan que el modelo no produce respuestas vacías)
 *   y todos los campos son strings (el LLM genera texto, no objetos complejos).
 *   `closeoutNotesSchema` define el objeto final de GIMA: incluye campos de
 *   aplicación (id, workOrderId, style, createdAt, metadata) que el LLM no genera.
 *
 * NOTA SOBRE closeoutNotesSchema SIN RESTRICCIONES DE LONGITUD:
 *   A diferencia de `aiCloseoutNotesSchema`, los campos de string en
 *   `closeoutNotesSchema` no tienen `.min()/.max()` porque en este punto
 *   el contenido ya fue validado al entrar por `aiCloseoutNotesSchema`.
 *   Agregar restricciones duplicadas solo añadiría complejidad sin beneficio.
 *
 */

import { z } from 'zod';

// ============================================================
// ENUMS INTERNOS
// ============================================================

/**
 * Estilos de notas de cierre válidos.
 *   - 'formal'    → Redacción corporativa para reportes a dirección o clientes externos.
 *   - 'technical' → Lenguaje de ingeniería con métricas, tolerancias y códigos de falla.
 *   - 'brief'     → Resumen conciso, ideal para seguimientos rápidos o historial simplificado.
 */
const closeoutStyleEnum = z.enum(['formal', 'technical', 'brief']);

// ============================================================
// SCHEMAS
// ============================================================

/**
 * Schema para los datos de la OT usados como contexto en la generación.
 *
 * CUÁNDO SE USA:
 *   Embebido dentro de `closeoutNotesRequestSchema` como el campo `workOrderData`.
 *   Valida que los datos de la OT pasados al servicio de IA tienen la estructura
 *   mínima necesaria para generar notas de cierre útiles.
 *
 * @property id            - ID único de la OT (para referencia y cache key).
 * @property title         - Título descriptivo del trabajo (máx 200 chars).
 * @property description   - Descripción detallada de la tarea (máx 1000 chars).
 * @property assetType     - Tipo de activo intervenido.
 * @property taskType      - Tipo de tarea realizada.
 * @property priority      - Nivel de prioridad de la OT ('baja', 'media', 'alta', 'critica').
 * @property activities    - Array de actividades realizadas. Al menos 1 requerida.
 * @property materialsUsed - Materiales o repuestos utilizados (opcional).
 * @property timeSpent     - Horas invertidas en el trabajo (debe ser > 0).
 * @property issues        - Problemas o hallazgos encontrados durante el trabajo (opcional).
 */
export const workOrderSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  assetType: z.string().min(1),
  taskType: z.string().min(1),
  priority: z.string().min(1),
  activities: z.array(z.string().min(1)).min(1),
  materialsUsed: z.array(z.string()).optional(),
  timeSpent: z.number().positive(),
  issues: z.array(z.string()).optional(),
});

/**
 * Schema para validar el request completo de generación de notas de cierre.
 *
 * CUÁNDO SE USA:
 *   En `WorkOrderCloseoutAIService.generateCloseoutNotes()` como primera
 *   validación antes de construir el prompt y llamar al LLM.
 *
 * @property workOrderId             - ID de la OT (para cache key y trazabilidad).
 * @property workOrderData           - Datos completos validados por workOrderSummarySchema.
 * @property style                   - Estilo de redacción de las notas generadas.
 * @property includeRecommendations  - Si el LLM debe incluir sección de recomendaciones.
 *                                     Default true — puede deshabilitarse para notas breves.
 */
export const closeoutNotesRequestSchema = z.object({
  workOrderId: z.string().min(1),
  workOrderData: workOrderSummarySchema,
  style: closeoutStyleEnum,
  includeRecommendations: z.boolean().default(true),
});

/**
 * Schema para validar la respuesta cruda del LLM.
 *
 * CUÁNDO SE USA:
 *   En `WorkOrderCloseoutAIService.parseAIResponse()` inmediatamente después
 *   del JSON.parse. Las restricciones de longitud mínima garantizan que el
 *   modelo no produce secciones vacías o con contenido insuficiente.
 *
 * RESTRICCIONES DE LONGITUD:
 *   - `summary`:       50-500 chars. Resumen ejecutivo conciso.
 *   - `workPerformed`: 100-1000 chars. La sección más detallada — requiere mínimo sustancial.
 *   - `findings`:      50-800 chars. Hallazgos y observaciones.
 *   - `materialsUsed`: 10-500 chars. Lista o descripción de materiales.
 *   - `timeBreakdown`: 20-300 chars. Distribución del tiempo invertido.
 *   Los campos opcionales (`recommendations`, `nextActions`) no tienen mínimo
 *   porque pueden estar ausentes si el LLM decide que no aplican.
 */
export const aiCloseoutNotesSchema = z.object({
  summary: z.string().min(50).max(500),
  workPerformed: z.string().min(100).max(1000),
  findings: z.string().min(50).max(800),
  recommendations: z.string().max(500).optional(),
  materialsUsed: z.string().min(10).max(500),
  timeBreakdown: z.string().min(20).max(300),
  nextActions: z.string().max(400).optional(),
});

/**
 * Schema para las notas de cierre completas almacenadas en GIMA.
 *
 * CUÁNDO SE USA:
 *   Como tipo de retorno del servicio a la UI. Incluye todos los campos
 *   de aplicación que `aiCloseoutNotesSchema` no cubre.
 *
 * METADATA:
 *   - `wordCount`     → Total de palabras en las secciones principales (para UI).
 *   - `generatedBy`   → Trazabilidad del origen ('ai' o 'manual').
 *   - `version`       → Versión del template de generación (para evolución futura).
 */
export const closeoutNotesSchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string(),
  summary: z.string(),
  workPerformed: z.string(),
  findings: z.string(),
  recommendations: z.string().optional(),
  materialsUsed: z.string(),
  timeBreakdown: z.string(),
  nextActions: z.string().optional(),
  style: closeoutStyleEnum,
  createdAt: z.date(),
  metadata: z
    .object({
      wordCount: z.number().int().positive().optional(),
      generatedBy: z.enum(['ai', 'manual']).optional(),
      version: z.string().optional(),
    })
    .optional(),
});

// ============================================================
// TIPOS INFERIDOS
// ============================================================

/** Datos de la OT usados como contexto para la generación de notas. */
export type WorkOrderSummary = z.infer<typeof workOrderSummarySchema>;

/** Request completo de generación de notas (OT + estilo + flags). */
export type CloseoutNotesRequest = z.infer<typeof closeoutNotesRequestSchema>;

/** Respuesta mínima del LLM antes de enriquecer con campos de aplicación. */
export type AICloseoutNotes = z.infer<typeof aiCloseoutNotesSchema>;

/** Notas de cierre completas con metadatos de aplicación. */
export type CloseoutNotes = z.infer<typeof closeoutNotesSchema>;
