/**
 * @file checklist.schema.ts
 * @module app/lib/schemas/checklist.schema
 *
 * ============================================================
 * SCHEMAS ZOD — VALIDACIÓN DE CHECKLISTS DE MANTENIMIENTO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod para todas las estructuras de datos involucradas
 *   en la generación y almacenamiento de checklists de mantenimiento:
 *     - `checklistGenerationRequestSchema` → Valida el input del usuario.
 *     - `checklistItemSchema`              → Valida un ítem individual.
 *     - `checklistSchema`                  → Valida el checklist completo.
 *     - `aiChecklistResponseSchema`        → Valida la respuesta cruda del LLM.
 *
 * CONTEXTO EN GIMA:
 *   Los checklists son generados dinámicamente por la IA para cada combinación
 *   de [assetType + taskType]. Estos schemas actúan como la capa de contrato
 *   que garantiza que tanto el input del técnico como el output del modelo
 *   cumplen con la estructura que la aplicación espera.
 *
 * RELACIÓN ENTRE SCHEMAS:
 *   checklistGenerationRequestSchema → Input del técnico en el UI
 *         ↓ (pasa a ChecklistAIService)
 *   aiChecklistResponseSchema        → Formato mínimo que el LLM debe retornar
 *         ↓ (enriquecido con IDs, timestamps, metadata en ChecklistAIService)
 *   checklistSchema                  → Formato completo almacenado y retornado a la UI
 *         ↓ (cada elemento del array `items`)
 *   checklistItemSchema              → Un ítem individual del checklist
 *
 * CONSTANTES REFERENCIADAS:
 *   - CHECKLIST_CATEGORIES (constants): categorías válidas de ítems.
 *   - CHECKLIST_LIMITS (constants): longitudes máximas y rango de ítems.
 *   - ASSET_TYPES, TASK_TYPES (constants/ai): enums de tipos de activos y tareas.
 *
 */

import { z } from 'zod';

import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_LIMITS,
} from '@/app/components/features/ai-tools/checklist-builder/constants';
import { ASSET_TYPES, TASK_TYPES } from '@/app/constants/ai';

// ============================================================
// SCHEMAS
// ============================================================

/**
 * Schema para validar el request de generación de checklist.
 *
 * CUÁNDO SE USA:
 *   En `ChecklistAIService.generateChecklist()` como primera capa de
 *   validación antes de llamar al LLM. Rechaza tipos de activo inválidos
 *   y textos de instrucciones demasiado largos antes de consumir tokens.
 *
 * @property assetType           - Tipo de activo del ASSET_TYPES enum.
 * @property taskType            - Tipo de tarea del TASK_TYPES enum.
 * @property customInstructions  - Instrucciones adicionales del técnico (máx 500 chars).
 * @property context             - Contexto del equipo (máx 200 chars, para mejor precisión).
 */
export const checklistGenerationRequestSchema = z.object({
  assetType: z.enum(ASSET_TYPES as any, {
    error: 'Tipo de activo inválido',
  }),
  taskType: z.enum(TASK_TYPES as any, {
    error: 'Tipo de tarea inválido',
  }),
  customInstructions: z
    .string()
    .max(500, 'Instrucciones demasiado largas (máx 500 caracteres)')
    .optional(),
  context: z.string().max(200).optional(),
});

/**
 * Schema para validar un ítem individual del checklist.
 *
 * CUÁNDO SE USA:
 *   Como sub-schema dentro de `checklistSchema` para validar cada elemento
 *   del array `items`. También se puede usar directamente para validar
 *   ítems editados por el usuario en el UI de ChecklistBuilder.
 *
 * @property id          - UUID único del ítem.
 * @property description - Descripción de la tarea (5-MAX_ITEM_DESCRIPTION_LENGTH chars).
 * @property category    - Categoría del ítem (del enum CHECKLIST_CATEGORIES).
 * @property order       - Posición del ítem en el checklist (entero >= 0).
 * @property required    - Si el ítem es obligatorio para completar el checklist.
 * @property notes       - Notas adicionales opcionales del técnico (máx 300 chars).
 */
export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  description: z
    .string()
    .min(5, 'Descripción muy corta')
    .max(CHECKLIST_LIMITS.MAX_ITEM_DESCRIPTION_LENGTH, 'Descripción muy larga'),
  category: z.enum(CHECKLIST_CATEGORIES as any, {
    error: 'Categoría inválida',
  }),
  order: z.number().int().nonnegative(),
  required: z.boolean(),
  notes: z.string().max(300).optional(),
});

/**
 * Schema para validar el checklist completo almacenado en GIMA.
 *
 * CUÁNDO SE USA:
 *   En `ChecklistAIService.parseAIResponse()` como validación final después
 *   de construir el checklist completo a partir de la respuesta del LLM.
 *   Garantiza que el objeto retornado a la UI tiene todos los campos requeridos.
 *
 * RESTRICCIONES CLAVE:
 *   - `items`: entre MIN_ITEMS y MAX_ITEMS ítems (definidos en CHECKLIST_LIMITS).
 *   - `title`: entre 5 y MAX_TITLE_LENGTH caracteres.
 *   - `metadata.generatedBy`: 'ai' o 'manual' (trazabilidad del origen).
 */
export const checklistSchema = z.object({
  id: z.string().uuid(),
  title: z
    .string()
    .min(5, 'Título muy corto')
    .max(CHECKLIST_LIMITS.MAX_TITLE_LENGTH, 'Título muy largo'),
  description: z.string().min(10).max(500),
  assetType: z.enum(ASSET_TYPES as any),
  taskType: z.enum(TASK_TYPES as any),
  items: z
    .array(checklistItemSchema)
    .min(CHECKLIST_LIMITS.MIN_ITEMS, `Mínimo ${CHECKLIST_LIMITS.MIN_ITEMS} items requeridos`)
    .max(CHECKLIST_LIMITS.MAX_ITEMS, `Máximo ${CHECKLIST_LIMITS.MAX_ITEMS} items permitidos`),
  createdAt: z.coerce.date(),
  isTemplate: z.boolean(),
  metadata: z
    .object({
      generatedBy: z.enum(['ai', 'manual']).optional(),
      version: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Schema para validar la respuesta cruda del LLM (formato mínimo esperado).
 *
 * CUÁNDO SE USA:
 *   En `ChecklistAIService.parseAIResponse()` como primera validación
 *   después del JSON.parse. Es más permisivo que `checklistSchema` porque
 *   el LLM no genera campos de aplicación como `id` o `createdAt`.
 *
 * POR QUÉ UN SCHEMA SEPARADO PARA EL LLM:
 *   Desacoplar el contrato con el LLM (lo que el modelo puede producir)
 *   del contrato con la UI (lo que la aplicación necesita). Si el schema
 *   del LLM cambia, solo se actualiza este schema sin afectar checklistSchema.
 */
export const aiChecklistResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      category: z.string(),
      required: z.boolean(),
      notes: z.string().optional(),
    })
  ),
});

// ============================================================
// TIPOS INFERIDOS
// ============================================================

/** Parámetros de entrada para generar un checklist. */
export type ChecklistGenerationRequest = z.infer<typeof checklistGenerationRequestSchema>;

/** Un ítem individual del checklist con todos sus campos. */
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

/** Checklist completo con metadatos de aplicación. */
export type Checklist = z.infer<typeof checklistSchema>;

/** Respuesta mínima esperada del LLM antes de enriquecer con campos de aplicación. */
export type AIChecklistResponse = z.infer<typeof aiChecklistResponseSchema>;
