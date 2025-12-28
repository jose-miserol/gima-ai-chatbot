/**
 * Schemas Zod para validación de checklists
 *
 * Define schemas para validar requests y responses
 * de la generación de checklists con IA.
 */

import { z } from 'zod';

import {
  CHECKLIST_CATEGORIES,
  CHECKLIST_LIMITS,
} from '@/app/components/features/checklist-builder/constants';
import { ASSET_TYPES, TASK_TYPES } from '@/app/constants/ai';

/**
 * Schema para request de generación de checklist
 */
export const checklistGenerationRequestSchema = z.object({
  assetType: z.enum(ASSET_TYPES, {
    errorMap: () => ({ message: 'Tipo de activo inválido' }),
  }),
  taskType: z.enum(TASK_TYPES, {
    errorMap: () => ({ message: 'Tipo de tarea inválido' }),
  }),
  customInstructions: z
    .string()
    .max(500, 'Instrucciones demasiado largas (máx 500 caracteres)')
    .optional(),
  context: z.string().max(200).optional(),
});

/**
 * Schema para un item individual de checklist
 */
export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  description: z
    .string()
    .min(5, 'Descripción muy corta')
    .max(CHECKLIST_LIMITS.MAX_ITEM_DESCRIPTION_LENGTH, 'Descripción muy larga'),
  category: z.enum(CHECKLIST_CATEGORIES, {
    errorMap: () => ({ message: 'Categoría inválida' }),
  }),
  order: z.number().int().nonnegative(),
  required: z.boolean(),
  notes: z.string().max(300).optional(),
});

/**
 * Schema para checklist completo
 */
export const checklistSchema = z.object({
  id: z.string().uuid(),
  title: z
    .string()
    .min(5, 'Título muy corto')
    .max(CHECKLIST_LIMITS.MAX_TITLE_LENGTH, 'Título muy largo'),
  description: z.string().min(10).max(500),
  assetType: z.enum(ASSET_TYPES),
  taskType: z.enum(TASK_TYPES),
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
 * Schema para response de la IA
 * (formato que esperamos del modelo)
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

/**
 * Tipos inferidos de los schemas
 */
export type ChecklistGenerationRequest = z.infer<typeof checklistGenerationRequestSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
export type AIChecklistResponse = z.infer<typeof aiChecklistResponseSchema>;
