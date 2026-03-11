/**
 * @file activity-summary.schema.ts
 * @module app/lib/schemas/activity-summary.schema
 *
 * ============================================================
 * SCHEMAS ZOD — RESÚMENES DE ACTIVIDADES DE MANTENIMIENTO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod para todas las estructuras de datos involucradas
 *   en la generación de resúmenes de actividades de mantenimiento:
 *     - `activitySummaryRequestSchema` → Valida el input del técnico.
 *     - `summarySectionSchema`         → Valida una sección individual del resumen.
 *     - `activitySummarySchema`        → Valida el resumen completo almacenado.
 *     - `aiSummaryResponseSchema`      → Valida la respuesta cruda del LLM.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos redactan notas de actividades en lenguaje informal durante
 *   el mantenimiento y luego solicitan a la IA que las convierta en un
 *   resumen profesional. Estos schemas definen el contrato de ese proceso:
 *   qué acepta el sistema como input y qué garantiza entregar como output.
 *
 * RELACIÓN ENTRE SCHEMAS:
 *   activitySummaryRequestSchema → Input del técnico (texto libre + preferencias)
 *         ↓ (pasa a ActivitySummaryAIService)
 *   aiSummaryResponseSchema      → Formato mínimo esperado del LLM
 *         ↓ (enriquecido con UUID, timestamps, metadata)
 *   activitySummarySchema        → Resumen completo almacenado y retornado a la UI
 *         ↓ (cada elemento del array `sections`)
 *   summarySectionSchema         → Una sección temática individual del resumen
 *
 * ENUMS INTERNOS (summaryStyleEnum, detailLevelEnum):
 *   Se definen como variables locales (no exportadas como schemas) porque
 *   solo se usan como sub-schemas dentro de los schemas principales.
 *   Los tipos string derivados ('ejecutivo' | 'tecnico' | 'narrativo') sí
 *   están disponibles vía los tipos inferidos exportados.
 *
 * RESTRICCIÓN EN aiSummaryResponseSchema:
 *   Este schema no incluye `id`, `assetType`, `taskType`, `style`,
 *   `detailLevel`, `createdAt` ni `metadata` porque el LLM no genera
 *   esos campos — son responsabilidad de ActivitySummaryAIService al
 *   construir el ActivitySummary completo.
 *
 */

import { z } from 'zod';

import { ASSET_TYPES, TASK_TYPES } from '@/app/constants/ai';

// ============================================================
// ENUMS INTERNOS
// ============================================================

/**
 * Estilos de resumen válidos.
 *   - 'ejecutivo'  → Lenguaje gerencial, sin jerga técnica, foco en impacto.
 *   - 'tecnico'    → Terminología de ingeniería, métricas, especificaciones.
 *   - 'narrativo'  → Redacción descriptiva y fluida, ideal para informes de campo.
 */
const summaryStyleEnum = z.enum(['ejecutivo', 'tecnico', 'narrativo']);

/**
 * Niveles de detalle del resumen.
 *   - 'alto'   → Todas las observaciones, lecturas y pasos realizados.
 *   - 'medio'  → Balance entre completitud y concisión. Recomendado por defecto.
 *   - 'bajo'   → Solo los hitos clave. Ideal para resúmenes ejecutivos rápidos.
 */
const detailLevelEnum = z.enum(['alto', 'medio', 'bajo']);

// ============================================================
// SCHEMAS
// ============================================================

/**
 * Schema para validar el request de generación de resumen.
 *
 * CUÁNDO SE USA:
 *   En `ActivitySummaryAIService.generateSummary()` como primera validación
 *   antes de llamar al LLM. Rechaza actividades demasiado cortas (< 10 chars)
 *   que no tendrían suficiente contenido para resumir, y bloques de texto
 *   excesivamente largos (> 5000 chars) que agotarían el contexto del modelo.
 *
 * @property assetType    - Tipo de activo sobre el que se realizó el mantenimiento.
 * @property taskType     - Tipo de tarea ejecutada ('preventivo', 'correctivo', etc.).
 * @property activities   - Notas crudas del técnico. Mín 10, máx 5000 chars.
 * @property style        - Estilo de redacción del resumen generado.
 * @property detailLevel  - Nivel de profundidad del contenido generado.
 * @property context      - Contexto adicional opcional para guiar al modelo (máx 500 chars).
 *                          Ej: "El equipo opera en ambiente corrosivo salino".
 */
export const activitySummaryRequestSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  taskType: z.enum(TASK_TYPES),
  activities: z
    .string()
    .min(10, 'Las actividades deben tener al menos 10 caracteres')
    .max(5000, 'Las actividades no pueden exceder 5000 caracteres'),
  style: summaryStyleEnum,
  detailLevel: detailLevelEnum,
  context: z.string().max(500, 'El contexto no puede exceder 500 caracteres').optional(),
});

/**
 * Schema para validar una sección individual del resumen.
 *
 * CUÁNDO SE USA:
 *   Como sub-schema en el array `sections` de `activitySummarySchema` y
 *   `aiSummaryResponseSchema`. Una sección agrupa contenido temáticamente
 *   relacionado (ej. "Observaciones", "Materiales", "Próximos pasos").
 *
 * @property title   - Encabezado de la sección (1-100 chars).
 * @property content - Cuerpo de la sección. Sin límite superior estricto
 *                     más allá del control a nivel de activitySummarySchema.
 * @property order   - Posición de la sección en el resumen (entero >= 0).
 *                     El LLM asigna el orden; si no lo provee, se usa el índice del array.
 */
export const summarySectionSchema = z.object({
  title: z.string().min(1, 'Título de sección requerido').max(100),
  content: z.string().min(1, 'Contenido de sección requerido'),
  order: z.number().int().min(0),
});

/**
 * Schema para validar el resumen de actividades completo almacenado en GIMA.
 *
 * CUÁNDO SE USA:
 *   Como tipo de retorno del servicio a la UI. Garantiza que el objeto
 *   retornado tiene todos los campos que los componentes de renderizado
 *   necesitan, incluyendo los generados por la aplicación (id, timestamps).
 *
 * RESTRICCIONES CLAVE:
 *   - `executive`: resumen de alto nivel (50-1000 chars). Es el texto que
 *     aparece primero en la tarjeta de resumen antes de expandir secciones.
 *   - `sections`: entre 1 y 10 secciones. El límite de 10 previene que el
 *     modelo genere resúmenes excesivamente fragmentados.
 *   - `metadata.readingTime`: tiempo estimado de lectura en minutos
 *     (calculado como wordCount / 200 en ActivitySummaryAIService).
 */
export const activitySummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(150),
  executive: z.string().min(50).max(1000),
  sections: z.array(summarySectionSchema).min(1).max(10),
  assetType: z.enum(ASSET_TYPES),
  taskType: z.enum(TASK_TYPES),
  style: summaryStyleEnum,
  detailLevel: detailLevelEnum,
  createdAt: z.date(),
  metadata: z
    .object({
      /** Número total de palabras (para mostrar en la UI). */
      wordCount: z.number().int().positive().optional(),
      /** Tiempo de lectura estimado en minutos (wordCount / 200). */
      readingTime: z.number().int().positive().optional(),
      /** Indica si fue generado por IA o creado manualmente. */
      generatedBy: z.enum(['ai', 'manual']).optional(),
      version: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema para validar la respuesta cruda del LLM (formato mínimo esperado).
 *
 * CUÁNDO SE USA:
 *   En `ActivitySummaryAIService.parseAIResponse()` como primera validación
 *   del JSON devuelto por GROQ. Es más permisivo que `activitySummarySchema`
 *   porque el LLM no genera campos de aplicación (id, assetType, createdAt, etc.).
 *
 * POR QUÉ LAS SECCIONES SON INLINE (no usan summarySectionSchema):
 *   El LLM puede omitir el campo `order` y usar un valor distinto de 0.
 *   Al validar la respuesta del LLM con este schema más permisivo y luego
 *   construir el objeto final en el servicio, se puede normalizar el orden
 *   usando el índice del array como fallback (`section.order ?? index`).
 */
export const aiSummaryResponseSchema = z.object({
  title: z.string().min(1).max(150),
  executive: z.string().min(50).max(1000),
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

// ============================================================
// TIPOS INFERIDOS
// ============================================================

/** Parámetros de entrada para generar un resumen de actividades. */
export type ActivitySummaryRequest = z.infer<typeof activitySummaryRequestSchema>;

/** Una sección temática individual del resumen con título, contenido y orden. */
export type SummarySection = z.infer<typeof summarySectionSchema>;

/** Resumen completo de actividades con metadatos de aplicación. */
export type ActivitySummary = z.infer<typeof activitySummarySchema>;

/** Respuesta mínima del LLM antes de enriquecer con campos de aplicación. */
export type AISummaryResponse = z.infer<typeof aiSummaryResponseSchema>;
