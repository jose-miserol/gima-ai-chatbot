/**
 * @file work-order-validation.ts
 * @module app/types/work-order-validation
 *
 * ============================================================
 * VALIDACIÓN Y SANITIZACIÓN DE PAYLOADS DE ÓRDENES DE TRABAJO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod para validar y sanitizar los datos de Órdenes de
 *   Trabajo (Work Orders) antes de enviarlos al backend Laravel de GIMA.
 *   Es la capa de defensa final entre los comandos de voz parseados por Gemini
 *   y la API REST del backend.
 *
 * POR QUÉ UNA CAPA DE VALIDACIÓN ESPECÍFICA PARA EL BACKEND:
 *   Los comandos de voz (VoiceWorkOrderCommand en voice-commands.ts) son
 *   validados para garantizar que Gemini los parseó correctamente.
 *   Pero el backend Laravel tiene su propio contrato de API con campos
 *   requeridos, formatos específicos y longitudes máximas diferentes.
 *
 *   Por ejemplo:
 *   - VoiceWorkOrderCommand: `equipment` es opcional (el usuario puede no mencionarlo)
 *   - CreateWorkOrderPayload: `equipment` es REQUERIDO (el backend lo necesita)
 *   Esta transformación ocurre en `sanitizeWorkOrderCommand()`.
 *
 * RESPONSABILIDADES DE ESTE MÓDULO:
 *   1. Definir el contrato exacto que el backend espera (CreateWorkOrderPayloadSchema).
 *   2. Transformar comandos de voz al formato del backend (sanitizeWorkOrderCommand).
 *   3. Validar payloads con mensajes de error en español (validateCreatePayload).
 *   4. Mapear valores de prioridad entre sistemas (mapPriorityToPayload).
 *
 * RELACIÓN CON OTROS MÓDULOS:
 *   - voice-commands.ts → define VoiceWorkOrderCommand (input de este módulo)
 *   - work-order-service.ts → consume CreateWorkOrderPayload (output de este módulo)
 *   - use-work-order-commands.ts → usa sanitizeWorkOrderCommand antes de llamar al servicio
 * ============================================================
 */

import { z } from 'zod';

// VoiceWorkOrderCommand: tipo del comando de voz que se transforma en payload
import type { VoiceWorkOrderCommand } from './voice-commands';

// ============================================================
// ENUM DE PRIORIDADES DEL BACKEND
// ============================================================

/**
 * WorkOrderPriorityPayload — Prioridades válidas según el contrato del backend Laravel.
 *
 * POR QUÉ SEPARADO DE WorkOrderPriority EN voice-commands.ts:
 *   El sistema de voz y el backend pueden usar vocabularios diferentes.
 *   Actualmente son iguales ('urgent', 'normal', 'low'), pero si el backend
 *   cambiara a usar números (1, 2, 3) o strings distintos ('alta', 'media', 'baja'),
 *   solo habría que actualizar este enum y la función mapPriorityToPayload(),
 *   sin tocar el schema de voz.
 *
 *   Incluye 'high' como opción adicional que el backend soporta pero el
 *   sistema de voz no expone directamente al usuario.
 */
export const WorkOrderPriorityPayload = z.enum(['low', 'normal', 'high', 'urgent']);

// ============================================================
// SCHEMA DE CREACIÓN DE WORK ORDER
// ============================================================

/**
 * CreateWorkOrderPayloadSchema — Schema del payload para crear una OT en el backend.
 *
 * QUÉ ES:
 *   La "forma exacta" que el backend Laravel espera en el body del POST
 *   a /api/ordenes-trabajo. Cada campo tiene las restricciones correctas
 *   según la documentación de la API.
 *
 * DIFERENCIAS CON VoiceWorkOrderCommandSchema:
 *   - `equipment` es REQUERIDO aquí (el backend no puede crear OT sin saber el equipo)
 *   - `location` es REQUERIDO aquí (la ubicación es obligatoria en el sistema GIMA)
 *   - Se añade `.trim()` a los strings para sanitizar espacios del reconocimiento de voz
 *   - Se incluye `voiceMetadata` para trazabilidad de comandos de voz en el backend
 *
 * CAMPO voiceMetadata:
 *   Registra el origen del comando (transcripción original + confianza + timestamp).
 *   Permite al backend GIMA:
 *   - Auditar qué OTs fueron creadas por voz vs manual.
 *   - Analizar la calidad de las transcripciones en producción.
 *   - Detectar patrones de comandos de voz erróneos.
 */
export const CreateWorkOrderPayloadSchema = z.object({
  /**
   * Equipo afectado (REQUERIDO).
   * `.trim()` elimina espacios del reconocimiento de voz (ej: " UMA " → "UMA").
   * Min 1 para rechazar strings vacíos después del trim.
   */
  equipment: z.string().trim().min(1, 'El equipo es requerido').max(100),

  /**
   * Ubicación del equipo en el campus UNEG (REQUERIDO).
   * Ejemplos: "Edificio 3", "Sótano Torre A", "Sala de Servidores"
   */
  location: z.string().trim().min(1, 'La ubicación es requerida').max(100),

  /**
   * Prioridad de la OT. Default 'normal' si no fue especificada en el comando.
   * El default garantiza que siempre haya un valor válido aunque el usuario
   * no mencione prioridad en su comando de voz.
   */
  priority: WorkOrderPriorityPayload.default('normal'),

  /** Descripción del problema o trabajo (opcional, max 1000 caracteres). */
  description: z.string().trim().max(1000).optional(),

  /** Técnico asignado si el usuario lo especificó en el comando. */
  assignee: z.string().trim().optional(),

  /**
   * Metadata del origen del comando de voz para trazabilidad y auditoría.
   * Siempre se incluye cuando la OT viene de un comando de voz.
   */
  voiceMetadata: z.object({
    /** Texto original transcrito por Gemini (antes de parsing de intención) */
    rawTranscript: z.string(),
    /** Nivel de confianza del parser [0-1]. Permite filtrar OTs de baja calidad. */
    confidence: z.number().min(0).max(1),
    /** ISO 8601 timestamp de cuando se procesó el comando (para ordering cronológico) */
    timestamp: z.string().datetime(),
  }),
});

/** Tipo TypeScript inferido del schema de creación (inferido de CreateWorkOrderPayloadSchema) */
export type CreateWorkOrderPayload = z.infer<typeof CreateWorkOrderPayloadSchema>;

// ============================================================
// SCHEMA DE ACTUALIZACIÓN DE WORK ORDER
// ============================================================

/**
 * UpdateWorkOrderPayloadSchema — Schema para actualizaciones parciales de OT.
 *
 * QUÉ ES:
 *   Todos los campos son opcionales (PATCH semantics: solo enviar lo que cambia).
 *   Permite actualizar prioridad, técnico, descripción o estado de forma independiente.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario dice "cambiar prioridad de la OT 123 a urgente" →
 *   solo se envía { priority: 'urgent' } sin necesidad de incluir el resto de los campos.
 */
export const UpdateWorkOrderPayloadSchema = z.object({
  /** Nueva prioridad (opcional: solo si el usuario la cambió) */
  priority: WorkOrderPriorityPayload.optional(),
  /** Nuevo técnico asignado (opcional) */
  assignee: z.string().trim().optional(),
  /** Nueva descripción (opcional, max 1000 caracteres) */
  description: z.string().trim().max(1000).optional(),
  /**
   * Nuevo estado de la OT.
   * Transiciones válidas generalmente son: pending → in_progress → completed.
   * Los comandos de voz solo pueden mover a 'in_progress' o 'completed'.
   */
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

/** Tipo TypeScript inferido del schema de actualización */
export type UpdateWorkOrderPayload = z.infer<typeof UpdateWorkOrderPayloadSchema>;

// ============================================================
// FUNCIONES DE TRANSFORMACIÓN Y VALIDACIÓN
// ============================================================

/**
 * Convierte un VoiceWorkOrderCommand en un CreateWorkOrderPayload validado.
 *
 * QUÉ HACE:
 *   Transforma los datos del comando de voz (parsados por Gemini) al formato
 *   exacto que el backend Laravel espera. Aplica:
 *   1. `.trim()` implícito en los strings (via el schema Zod).
 *   2. Default de prioridad 'normal' si no fue especificada.
 *   3. Generación del timestamp de procesamiento.
 *   4. Validación final con Zod que lanza ZodError si algo es inválido.
 *
 * POR QUÉ LANZA ZodError EN VEZ DE RETORNAR SUCCESS/ERROR:
 *   Esta función es llamada en un contexto donde ya se validó el comando de voz
 *   previamente. Si llega aquí con datos inválidos, es un bug del sistema
 *   (no un error del usuario). Lanzar la excepción fuerza al llamador a manejarlo
 *   o propagarlo hacia arriba para debugging.
 *   Para validación con manejo de errores amigable, usar `validateCreatePayload()`.
 *
 * @param command  - Comando de voz validado por VoiceWorkOrderCommandSchema.
 * @param _userId  - ID del usuario actual (reservado para futuras expansiones de auditoría).
 * @returns Payload validado y listo para enviar al backend.
 * @throws ZodError si algún campo requerido del payload está ausente (ej: equipment undefined).
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
      timestamp: new Date().toISOString(), // Timestamp del momento de ejecución
    },
  });
}

/**
 * Mapea la prioridad del schema de voz al formato del backend.
 *
 * QUÉ HACE:
 *   Función de transformación para desacoplar los valores de prioridad
 *   del sistema de voz de los valores del backend. Actualmente ambos son
 *   iguales, pero esta función es el punto de extensión si divergen.
 *
 * EJEMPLO DE FUTURO CAMBIO:
 *   Si el backend migrara a { 1: 'low', 2: 'normal', 3: 'high', 4: 'urgent' },
 *   solo habría que actualizar esta función, sin tocar los schemas de voz ni
 *   los componentes que los usan.
 *
 * @param priority - Valor de prioridad del comando de voz (puede ser undefined).
 * @returns Valor de prioridad compatible con WorkOrderPriorityPayload. Default: 'normal'.
 */
function mapPriorityToPayload(
  priority: VoiceWorkOrderCommand['priority']
): z.infer<typeof WorkOrderPriorityPayload> {
  if (!priority) return 'normal'; // Default cuando el usuario no especificó prioridad
  return priority; // Actualmente los valores son idénticos en ambos sistemas
}

/**
 * Valida un payload de creación con mensajes de error en español para la UI.
 *
 * QUÉ HACE:
 *   Similar a sanitizeWorkOrderCommand() pero en lugar de lanzar excepciones,
 *   retorna un objeto con success/errors para que la UI pueda mostrar mensajes
 *   específicos al usuario. Útil en formularios de edición manual de OTs.
 *
 * CUÁNDO USAR ESTO VS sanitizeWorkOrderCommand():
 *   - sanitizeWorkOrderCommand(): flujo de comandos de voz (los errores son bugs).
 *   - validateCreatePayload(): formularios de UI (los errores son del usuario).
 *
 * @param data - Datos a validar (puede ser el body de un formulario, sin tipar).
 * @returns Objeto con `success: true` y `data` validada, o `success: false` y `errors` legibles.
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

  // Formatear errores de Zod a strings legibles: "campo: mensaje de error"
  const errors = result.error.issues.map((issue) => {
    const field = issue.path.join('.'); // "voiceMetadata.confidence" etc.
    return `${field}: ${issue.message}`;
  });

  return { success: false, errors };
}
