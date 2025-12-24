/**
 * Validación de Work Orders
 *
 * Schemas Zod para validación y sanitización de payloads
 * de creación de Work Orders. Garantiza que los datos
 * enviados al backend cumplan con el contrato esperado.
 *
 * @example
 * ```typescript
 * import {
 *   CreateWorkOrderPayloadSchema,
 *   sanitizeWorkOrderCommand
 * } from '@/app/types/work-order-validation';
 *
 * const payload = sanitizeWorkOrderCommand(voiceCommand, userId);
 * ```
 */

import { z } from 'zod';
import type { VoiceWorkOrderCommand } from './voice-commands';

/**
 * Prioridades válidas para Work Orders
 * Mapea a valores esperados por el backend
 */
export const WorkOrderPriorityPayload = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * Schema de validación para creación de Work Orders
 * Sanitiza inputs antes de enviar al backend
 */
export const CreateWorkOrderPayloadSchema = z.object({
  /** Equipo afectado (requerido, 1-100 caracteres) */
  equipment: z.string().trim().min(1, 'El equipo es requerido').max(100),
  /** Ubicación del equipo (requerido, 1-100 caracteres) */
  location: z.string().trim().min(1, 'La ubicación es requerida').max(100),
  /** Prioridad de la orden (default: normal) */
  priority: WorkOrderPriorityPayload.default('normal'),
  /** Descripción del problema o trabajo (max 1000 caracteres) */
  description: z.string().trim().max(1000).optional(),
  /** Técnico asignado (opcional) */
  assignee: z.string().trim().optional(),
  /** Metadata del comando de voz original */
  voiceMetadata: z.object({
    /** Transcripción original */
    rawTranscript: z.string(),
    /** Nivel de confianza de la transcripción */
    confidence: z.number().min(0).max(1),
    /** Timestamp de cuando se procesó */
    timestamp: z.string().datetime(),
  }),
});

/**
 * Tipo inferido del payload de creación
 */
export type CreateWorkOrderPayload = z.infer<typeof CreateWorkOrderPayloadSchema>;

/**
 * Schema para actualización de Work Order
 * Todos los campos son opcionales
 */
export const UpdateWorkOrderPayloadSchema = z.object({
  /** Nueva prioridad */
  priority: WorkOrderPriorityPayload.optional(),
  /** Nuevo técnico asignado */
  assignee: z.string().trim().optional(),
  /** Nueva descripción */
  description: z.string().trim().max(1000).optional(),
  /** Nuevo estado */
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

/**
 * Tipo inferido del payload de actualización
 */
export type UpdateWorkOrderPayload = z.infer<typeof UpdateWorkOrderPayloadSchema>;

/**
 * Convierte VoiceWorkOrderCommand a payload validado para el backend
 *
 * Realiza:
 * - Trim de strings
 * - Aplicación de defaults
 * - Validación de schema
 * - Generación de metadata de voz
 *
 * @param command - Comando de voz parseado por Gemini
 * @param _userId - ID del usuario (para futuras expansiones)
 * @returns Payload validado listo para enviar al backend
 * @throws ZodError si la validación falla
 */
export function sanitizeWorkOrderCommand(
  command: VoiceWorkOrderCommand,
  _userId: string
): CreateWorkOrderPayload {
  return CreateWorkOrderPayloadSchema.parse({
    equipment: command.equipment,
    location: command.location,
    priority: mapPriorityToPayload(command.priority),
    description: command.description,
    assignee: command.assignee,
    voiceMetadata: {
      rawTranscript: command.rawTranscript,
      confidence: command.confidence,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Mapea prioridad del comando de voz al formato del backend
 * El schema de voz usa 'urgent' pero el backend podría esperar 'high'
 */
function mapPriorityToPayload(
  priority: VoiceWorkOrderCommand['priority']
): z.infer<typeof WorkOrderPriorityPayload> {
  if (!priority) return 'normal';
  // Mapear si es necesario (actualmente son iguales)
  return priority;
}

/**
 * Valida un payload de creación con mensajes de error en español
 *
 * @param data - Datos a validar
 * @returns Resultado de validación con errores formateados
 */
export function validateCreatePayload(data: unknown): {
  success: boolean;
  data?: CreateWorkOrderPayload;
  errors?: string[];
} {
  const result = CreateWorkOrderPayloadSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const field = issue.path.join('.');
    return `${field}: ${issue.message}`;
  });

  return { success: false, errors };
}
