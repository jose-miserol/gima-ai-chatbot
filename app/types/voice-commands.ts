/**
 * Tipos y Esquemas de Comandos de Voz
 *
 * Define tipos TypeScript y schemas Zod para comandos de voz
 * Valida estructura y contenido en runtime
 *
 * @example
 * ```typescript
 * import { VoiceWorkOrderCommandSchema } from '@/app/types/voice-commands';
 *
 * const result = VoiceWorkOrderCommandSchema.safeParse(parsedData);
 * if (result.success) {
 *   // Usar result.data con seguridad de tipos
 * }
 * ```
 */

import { z } from 'zod';

/**
 * Acciones disponibles para comandos de voz
 * Relacionadas con órdenes de trabajo (work orders)
 */
export const VoiceCommandAction = z.enum([
  'create_work_order', // Crear nueva orden de trabajo
  'check_status', // Verificar estado de orden
  'list_pending', // Listar órdenes pendientes
  'update_priority', // Actualizar prioridad de orden
  'assign_technician', // Asignar técnico a orden
]);

/**
 * Niveles de prioridad para órdenes de trabajo
 */
export const WorkOrderPriority = z.enum([
  'urgent', // Urgente - atención inmediata
  'normal', // Normal - prioridad estándar
  'low', // Baja - puede esperar
]);

/**
 * Schema de validación para comandos de voz de órdenes de trabajo
 *
 * Valida que el comando parseado contenga:
 * - Acción válida
 * - Nivel de confianza aceptable
 * - Información opcional (equipo, ubicación, prioridad)
 */
export const VoiceWorkOrderCommandSchema = z.object({
  /** Acción a ejecutar */
  action: VoiceCommandAction,

  /** Equipo mencionado (UMA, BCA, TAB, etc.) */
  equipment: z.string().min(2).max(100).optional(),

  /** Ubicación o sector mencionado */
  location: z.string().min(2).max(50).optional(),

  /** Prioridad especificada */
  priority: WorkOrderPriority.optional(),

  /** Descripción del problema o trabajo */
  description: z.string().min(5).max(500).optional(),

  /** Técnico mencionado para asignación */
  assignee: z.string().max(100).optional(),

  /**
   * Nivel de confianza de la transcripción (0-1)
   * Valores < 0.7 deberían rechazarse
   */
  confidence: z.number().min(0).max(1),

  /** Transcripción original sin procesar */
  rawTranscript: z.string().min(1),

  /** Metadata adicional del procesamiento */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Tipo inferido del schema de comando de voz
 */
export type VoiceWorkOrderCommand = z.infer<typeof VoiceWorkOrderCommandSchema>;

/**
 * Schema para resultado exitoso de parsing de comando
 */
const VoiceCommandSuccessSchema = z.object({
  success: z.literal(true),
  command: VoiceWorkOrderCommandSchema,
});

/**
 * Schema para resultado fallido de parsing de comando
 */
const VoiceCommandErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  recoverable: z.boolean().optional(),
});

/**
 * Schema discriminado para resultado de parsing
 * Permite type-safe handling de success/error
 */
export const VoiceCommandResultSchema = z.discriminatedUnion('success', [
  VoiceCommandSuccessSchema,
  VoiceCommandErrorSchema,
]);

/**
 * Tipo inferido del resultado de parsing
 */
export type VoiceCommandResult = z.infer<typeof VoiceCommandResultSchema>;

/**
 * Opciones para el parser de comandos de voz
 */
export const VoiceParserOptionsSchema = z.object({
  /** Idioma de la transcripción */
  language: z.enum(['es-ES', 'en-US']).default('es-ES'),

  /** Nivel mínimo de confianza aceptable */
  minConfidence: z.number().min(0).max(1).default(0.7),

  /** Modelo de IA a usar para parsing */
  model: z.string().optional(),

  /** Contexto adicional para mejorar parsing */
  context: z.string().max(200).optional(),
});

/**
 * Tipo de opciones para parser
 */
export type VoiceParserOptions = z.infer<typeof VoiceParserOptionsSchema>;

/**
 * Schema para estado de ejecución de comando
 */
export const CommandExecutionStatusSchema = z.enum([
  'pending', // En espera de confirmación
  'executing', // Ejecutándose
  'completed', // Completado exitosamente
  'failed', // Falló
  'cancelled', // Cancelado por usuario
]);

/**
 * Tipo de estado de ejecución
 */
export type CommandExecutionStatus = z.infer<typeof CommandExecutionStatusSchema>;

/**
 * Schema para resultado de ejecución de comando
 */
export const CommandExecutionResultSchema = z.object({
  /** ID del comando ejecutado */
  commandId: z.string().uuid().optional(),

  /** Estado de la ejecución */
  status: CommandExecutionStatusSchema,

  /** Mensaje descriptivo del resultado */
  message: z.string(),

  /** Datos del recurso creado/modificado (ej: ID de work order) */
  resourceId: z.string().optional(),

  /** URL del recurso creado (opcional) */
  resourceUrl: z.string().url().optional(),

  /** Timestamp de ejecución */
  executedAt: z.date().optional(),
});

/**
 * Tipo de resultado de ejecución
 */
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>;

/**
 * Helper: Valida comando de voz con error handling mejorado
 *
 * @param data - Datos a validar
 * @returns Resultado de validación con mensajes de error claros
 */
export function validateVoiceCommand(data: unknown): {
  success: boolean;
  data?: VoiceWorkOrderCommand;
  errors?: string[];
} {
  const result = VoiceWorkOrderCommandSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Formatear errores de Zod para usuario
  const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);

  return { success: false, errors };
}

/**
 * Helper: Crea comando de voz vacío con defaults
 * Útil para testing o inicialización
 */
export function createEmptyCommand(): Partial<VoiceWorkOrderCommand> {
  return {
    action: 'create_work_order',
    confidence: 0,
    rawTranscript: '',
  };
}

/**
 * Helper: Verifica si un comando requiere confirmación del usuario
 * Comandos destructivos o de alta importancia requieren confirmación
 */
export function requiresConfirmation(command: VoiceWorkOrderCommand): boolean {
  // Crear órdenes urgentes requiere confirmación
  if (command.priority === 'urgent') {
    return true;
  }

  // Asignar técnico requiere confirmación
  if (command.action === 'assign_technician') {
    return true;
  }

  // Confidence bajo requiere confirmación
  if (command.confidence < 0.85) {
    return true;
  }

  return false;
}

/**
 * Helper: Genera resumen legible del comando para mostrar al usuario
 */
export function formatCommandSummary(command: VoiceWorkOrderCommand): string {
  const parts: string[] = [];

  switch (command.action) {
    case 'create_work_order':
      parts.push('Crear orden de trabajo');
      break;
    case 'check_status':
      parts.push('Verificar estado');
      break;
    case 'list_pending':
      parts.push('Listar órdenes pendientes');
      break;
    case 'update_priority':
      parts.push('Actualizar prioridad');
      break;
    case 'assign_technician':
      parts.push('Asignar técnico');
      break;
  }

  if (command.equipment) {
    parts.push(`para ${command.equipment}`);
  }

  if (command.location) {
    parts.push(`en ${command.location}`);
  }

  if (command.priority) {
    parts.push(`(Prioridad: ${command.priority})`);
  }

  return parts.join(' ');
}
