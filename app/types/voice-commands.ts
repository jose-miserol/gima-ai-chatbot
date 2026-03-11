/**
 * @file voice-commands.ts
 * @module app/types/voice-commands
 *
 * ============================================================
 * TIPOS Y SCHEMAS — COMANDOS DE VOZ DEL SISTEMA GIMA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define la estructura completa del sistema de comandos de voz de GIMA:
 *   schemas Zod para validación en runtime, tipos TypeScript inferidos de
 *   esos schemas, y funciones helper para trabajar con comandos.
 *
 * ARQUITECTURA DE TIPOS DE COMANDOS:
 *   Los comandos de voz están organizados en tres categorías independientes,
 *   unidas en una discriminated union por el campo `type`:
 *
 *
 *   VoiceCommand (discriminated union por `type`)
 *   - VoiceWorkOrderCommand   (type: 'work_order')
 *      - Acciones: crear OT, verificar estado, asignar técnico
 *   - VoiceNavigationCommand  (type: 'navigation')
 *      - Acciones: navegar a pantalla, ir atrás
 *   - VoiceSystemCommand      (type: 'system')
 *      - Acciones: cambiar tema, cerrar sesión, resumir
 *
 *
 * FLUJO DE VIDA DE UN COMANDO:
 *   1. [useVoiceInput] graba audio → Gemini transcribe
 *   2. [VoiceCommandParserService] parsea transcript → llama a Gemini para inferir intención
 *   3. [VoiceCommandSchema.safeParse()] valida la respuesta de Gemini contra este schema
 *   4. Si válido → devuelve `VoiceCommand` tipado
 *   5. [requiresConfirmation()] decide si mostrar diálogo de confirmación
 *   6. [formatCommandSummary()] genera texto para mostrar en el diálogo
 *   7. [useWorkOrderCommands] ejecuta el comando contra el backend
 *
 * POR QUÉ ZOD Y NO SOLO INTERFACES TYPESCRIPT:
 *   TypeScript solo valida en compilación. Los comandos vienen de una respuesta
 *   de Gemini (texto parseado en runtime), no del sistema de tipos.
 *   Zod valida que el JSON que retornó Gemini sea realmente un comando válido,
 *   con confianza ≥ 0, transcript no vacío, etc.
 *
 * DÓNDE SE USA:
 *   - app/lib/services/voice-command-parser.ts → parseCommand() retorna VoiceCommand
 *   - app/actions/voice.ts → executeVoiceCommand() recibe el resultado del parser
 *   - app/hooks/use-work-order-commands.ts → recibe VoiceWorkOrderCommand
 *   - app/components/features/voice/ → renderiza el resumen del comando
 * ============================================================
 */

import { z } from 'zod';

// ============================================================
// ACCIONES DISPONIBLES POR CATEGORÍA
// ============================================================

/**
 * VoiceCommandAction — Acciones disponibles para comandos de Work Orders.
 *
 * QUÉ ES:
 *   Enum Zod de las operaciones que el usuario puede ejecutar sobre
 *   Órdenes de Trabajo mediante comandos de voz.
 *
 * MAPEO A OPERACIONES DEL BACKEND:
 *   'create_work_order' → POST /api/ordenes-trabajo
 *   'check_status'      → GET /api/ordenes-trabajo/:id/estado
 *   'list_pending'      → GET /api/ordenes-trabajo?estado=pendiente
 *   'update_priority'   → PATCH /api/ordenes-trabajo/:id
 *   'assign_technician' → PATCH /api/ordenes-trabajo/:id/tecnico
 */
export const VoiceCommandAction = z.enum([
  'create_work_order', // Crear nueva Orden de Trabajo
  'check_status', // Verificar estado de una OT existente
  'list_pending', // Listar OTs pendientes
  'update_priority', // Cambiar prioridad de una OT
  'assign_technician', // Asignar técnico a una OT
]);

/**
 * VoiceNavigationAction — Acciones de navegación dentro de la aplicación.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario dice "ir a configuración", "volver atrás", etc.
 *   El parser de Gemini detecta la intención de navegación y genera
 *   un VoiceNavigationCommand con la ruta/pantalla destino.
 */
export const VoiceNavigationAction = z.enum([
  'navigate', // Ir a una pantalla específica (ej: /dashboard, /inventario)
  'go_back', // Volver a la pantalla anterior
]);

/**
 * VoiceSystemAction — Acciones del sistema que no son de negocio.
 *
 * NOTA SOBRE 'logout':
 *   Esta acción requiere confirmación (ver requiresConfirmation()).
 *   Nunca debe ejecutarse directamente por el parser sin interacción del usuario.
 */
export const VoiceSystemAction = z.enum([
  'theme_mode', // Cambiar entre tema oscuro y claro
  'logout', // Cerrar sesión (requiere confirmación explícita)
  'summarize', // Generar resumen de actividad reciente
]);

/**
 * WorkOrderPriority — Niveles de prioridad válidos para Órdenes de Trabajo.
 *
 * CORRESPONDENCIA CON EL BACKEND:
 *   Estos valores son los que el backend Laravel espera en el campo `prioridad`.
 *   Ver trabajo de mapeo en work-order-validation.ts → mapPriorityToPayload().
 */
export const WorkOrderPriority = z.enum([
  'urgent', // Urgente: requiere atención inmediata (falla crítica de sistema)
  'normal', // Normal: prioridad estándar para mantenimiento regular
  'low', // Baja: puede programarse para cuando haya disponibilidad
]);

// ============================================================
// SCHEMAS DE COMANDOS POR CATEGORÍA
// ============================================================

/**
 * VoiceWorkOrderCommandSchema — Schema para comandos de Órdenes de Trabajo.
 *
 * QUÉ ES:
 *   El schema más complejo y usado del sistema. Valida que la respuesta de
 *   Gemini contenga todos los campos necesarios para crear o gestionar una OT.
 *
 * CAMPOS OPCIONALES VS REQUERIDOS:
 *   Los campos `equipment`, `location`, `priority`, `description` y `assignee`
 *   son opcionales porque el usuario puede no mencionarlos en el comando de voz.
 *   El flujo de confirmación (requiresConfirmation + diálogo) solicita los
 *   datos faltantes antes de ejecutar.
 *
 *   `confidence` y `rawTranscript` son SIEMPRE requeridos porque:
 *   - confidence: VoiceCommandParserService los rechaza si < 0.7.
 *   - rawTranscript: necesario para debugging y auditoría.
 *
 * CAMPO `type` CON DEFAULT:
 *   `z.literal('work_order').default('work_order')` establece el discriminador
 *   de la union. Gemini puede no incluirlo en su respuesta, pero Zod lo añade
 *   automáticamente, garantizando que siempre esté presente para el type narrowing.
 */
export const VoiceWorkOrderCommandSchema = z.object({
  /** Operación a realizar sobre la OT (crear, verificar, asignar, etc.) */
  action: VoiceCommandAction,

  /**
   * Equipo mencionado en el comando (UMA, BCA, TAB, etc. del glosario GIMA).
   * Min 2 caracteres para filtrar transcripciones parciales ("U", "la").
   */
  equipment: z.string().min(2).max(100).optional(),

  /** Ubicación o sector del campus UNEG donde está el equipo */
  location: z.string().min(2).max(50).optional(),

  /** Prioridad especificada por el usuario ("urgente", "normal", "baja") */
  priority: WorkOrderPriority.optional(),

  /**
   * Descripción del problema o trabajo a realizar.
   * Min 5 caracteres para filtrar transcripciones muy cortas o ruido.
   * Max 500 para evitar payloads excesivos al backend.
   */
  description: z.string().min(5).max(500).optional(),

  /** Nombre del técnico a asignar si el usuario lo mencionó explícitamente */
  assignee: z.string().max(100).optional(),

  /**
   * Nivel de confianza del parser de Gemini sobre la intención [0-1].
   * Valores < 0.7 → VoiceCommandParserService rechaza el comando.
   * Valores < 0.85 → requiresConfirmation() devuelve true (más cautela).
   */
  confidence: z.number().min(0).max(1),

  /** Texto original transcrito, sin procesar. Para auditoría y debugging. */
  rawTranscript: z.string().min(1),

  /** Metadata adicional del pipeline de procesamiento (timestamps, versión del modelo, etc.) */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /**
   * Discriminador de la union VoiceCommand. Siempre 'work_order'.
   * El `.default('work_order')` lo añade automáticamente si Gemini lo omite.
   */
  type: z.literal('work_order').default('work_order'),
});

/**
 * VoiceNavigationCommandSchema — Schema para comandos de navegación.
 *
 * CAMPOS OPCIONALES:
 *   `path` y `screen` son opcionales porque el usuario puede decir
 *   "ir a configuración" (screen: 'configuración', sin path conocido)
 *   o "ir a /activos" (path conocido). El router de GIMA resuelve el caso.
 */
export const VoiceNavigationCommandSchema = z.object({
  action: VoiceNavigationAction,
  /** Ruta técnica del destino (ej: '/dashboard', '/inventario/activos') */
  path: z.string().optional(),
  /** Nombre amigable de la pantalla destino (ej: 'Inventario', 'Configuración') */
  screen: z.string().optional(),
  /** Parámetros de ruta adicionales (ej: { id: '123' } para una OT específica) */
  params: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1),
  rawTranscript: z.string().min(1),
  type: z.literal('navigation').default('navigation'),
});

/**
 * VoiceSystemCommandSchema — Schema para comandos del sistema.
 *
 * CAMPO `value`:
 *   Parámetro genérico del comando. Ejemplos:
 *   - 'dark' o 'light' para action 'theme_mode'
 *   - undefined para 'logout' (no necesita parámetro)
 */
export const VoiceSystemCommandSchema = z.object({
  action: VoiceSystemAction,
  /** Parámetro de la acción (ej: 'dark' para theme, undefined para logout) */
  value: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rawTranscript: z.string().min(1),
  type: z.literal('system').default('system'),
});

// ============================================================
// TIPOS INFERIDOS DE LOS SCHEMAS
// ============================================================

/** Tipo TypeScript del comando de Work Order (inferido de VoiceWorkOrderCommandSchema) */
export type VoiceWorkOrderCommand = z.infer<typeof VoiceWorkOrderCommandSchema>;

/** Tipo TypeScript del comando de navegación (inferido de VoiceNavigationCommandSchema) */
export type VoiceNavigationCommand = z.infer<typeof VoiceNavigationCommandSchema>;

/** Tipo TypeScript del comando de sistema (inferido de VoiceSystemCommandSchema) */
export type VoiceSystemCommand = z.infer<typeof VoiceSystemCommandSchema>;

/**
 * VoiceCommandSchema — Discriminated union de todos los tipos de comandos.
 *
 * QUÉ ES:
 *   El schema principal que acepta cualquier tipo de comando de voz.
 *   `z.discriminatedUnion('type', [...])` es más eficiente que `z.union([...])`
 *   porque Zod usa el campo `type` para seleccionar el schema correcto
 *   directamente en lugar de intentar todos en orden.
 *
 * USO EN EL PARSER:
 *   VoiceCommandParserService llama a `VoiceCommandSchema.safeParse(geminiResponse)`
 *   para validar que Gemini produjo un comando válido del tipo correcto.
 */
export const VoiceCommandSchema = z.discriminatedUnion('type', [
  VoiceWorkOrderCommandSchema,
  VoiceNavigationCommandSchema,
  VoiceSystemCommandSchema,
]);

/**
 * VoiceCommand — Tipo union de todos los comandos de voz posibles.
 * El campo `type` permite type narrowing en el código consumidor.
 */
export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;

// ============================================================
// SCHEMAS DE RESULTADO DEL PARSER
// ============================================================

/**
 * Resultado exitoso del parser: el comando fue parseado y validado.
 * Se usa `z.literal(true)` para que Zod pueda discriminar el union por `success`.
 */
const VoiceCommandSuccessSchema = z.object({
  success: z.literal(true),
  command: VoiceCommandSchema,
});

/**
 * Resultado fallido del parser: Gemini no pudo inferir la intención
 * o la confianza fue muy baja.
 */
const VoiceCommandErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(), // Mensaje de error legible
  code: z.string().optional(), // Código de error para manejo programático
  recoverable: z.boolean().optional(), // true si el usuario puede reintentar
});

/**
 * VoiceCommandResultSchema — Discriminated union del resultado del parser.
 *
 * QUÉ ES:
 *   El tipo de retorno de VoiceCommandParserService.parseCommand().
 *   Permite al código consumidor hacer type narrowing por `result.success`:
 *   ```typescript
 *   if (result.success) {
 *     // TypeScript sabe que result.command existe
 *   } else {
 *     // TypeScript sabe que result.error existe
 *   }
 *   ```
 */
export const VoiceCommandResultSchema = z.discriminatedUnion('success', [
  VoiceCommandSuccessSchema,
  VoiceCommandErrorSchema,
]);

/** Tipo TypeScript del resultado del parser (inferido de VoiceCommandResultSchema) */
export type VoiceCommandResult = z.infer<typeof VoiceCommandResultSchema>;

// ============================================================
// OPCIONES DEL PARSER
// ============================================================

/**
 * VoiceParserOptionsSchema — Configuración para VoiceCommandParserService.parseCommand().
 *
 * CAMPO minConfidence:
 *   Umbral de confianza mínimo para aceptar un comando parseado.
 *   Default 0.7 (70%): si Gemini está menos de 70% seguro de la intención,
 *   se rechaza y se le pide al usuario que repita.
 *   Aumentar a 0.85+ para aplicaciones críticas, bajar a 0.6 si hay muchos
 *   rechazos falsos en el entorno de trabajo.
 */
export const VoiceParserOptionsSchema = z.object({
  /** Idioma de la transcripción para contextualizar el parser ('es-ES' por defecto) */
  language: z.enum(['es-ES', 'en-US']).default('es-ES'),
  /** Confianza mínima para aceptar un comando [0-1]. Default 0.7. */
  minConfidence: z.number().min(0).max(1).default(0.7),
  /** Modelo de IA a usar para el parsing (override del default AI_TASK_MODELS.VOICE_COMMAND_PARSING) */
  model: z.string().optional(),
  /** Contexto adicional sobre el módulo activo (ej: 'módulo inventario') para mejorar precisión */
  context: z.string().max(200).optional(),
});

/** Tipo TypeScript de las opciones del parser */
export type VoiceParserOptions = z.infer<typeof VoiceParserOptionsSchema>;

// ============================================================
// ESTADO DE EJECUCIÓN DE COMANDOS
// ============================================================

/**
 * CommandExecutionStatusSchema — Estados del ciclo de vida de ejecución de un comando.
 * Más granular que CommandStatus de use-work-order-commands.ts porque incluye
 * 'pending' (esperando confirmación del usuario) y 'cancelled'.
 */
export const CommandExecutionStatusSchema = z.enum([
  'pending', // Parseado, esperando confirmación del usuario en el diálogo
  'executing', // Enviado al backend, esperando respuesta
  'completed', // Backend confirmó la creación/actualización de la OT
  'failed', // El backend rechazó el comando o hubo error de red
  'cancelled', // El usuario canceló en el diálogo de confirmación
]);

/** Tipo TypeScript del estado de ejecución */
export type CommandExecutionStatus = z.infer<typeof CommandExecutionStatusSchema>;

/**
 * CommandExecutionResultSchema — Resultado detallado de la ejecución de un comando.
 *
 * QUÉ ES:
 *   La respuesta completa que el sistema devuelve tras ejecutar un comando,
 *   incluyendo el ID del recurso creado y la URL para acceder a él.
 */
export const CommandExecutionResultSchema = z.object({
  /** UUID del registro de comando en el backend (para auditoría) */
  commandId: z.string().uuid().optional(),
  /** Estado final de la ejecución */
  status: CommandExecutionStatusSchema,
  /** Mensaje descriptivo del resultado para mostrar al usuario */
  message: z.string(),
  /** ID del recurso creado o modificado (ej: ID de la OT creada) */
  resourceId: z.string().optional(),
  /** URL para navegar al recurso creado (ej: '/ordenes-trabajo/123') */
  resourceUrl: z.string().url().optional(),
  /** Timestamp de cuándo se ejecutó el comando */
  executedAt: z.date().optional(),
});

/** Tipo TypeScript del resultado de ejecución */
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>;

// ============================================================
// FUNCIONES HELPER
// ============================================================

/**
 * Valida un objeto como VoiceWorkOrderCommand con mensajes de error formateados.
 *
 * QUÉ HACE:
 *   Wrapper sobre `VoiceWorkOrderCommandSchema.safeParse()` que formatea los
 *   errores de Zod en strings legibles con el path del campo incluido.
 *
 * POR QUÉ EXISTE (y no usar safeParse directamente):
 *   Los errores raw de Zod son objetos complejos (ZodIssue[]) que necesitan
 *   procesamiento para mostrarse al usuario o en logs. Esta función los
 *   transforma en strings simples como "equipment: String must contain at least 2 character(s)".
 *
 * @param data - Objeto a validar (puede ser la respuesta de Gemini sin tipar).
 * @returns Objeto con `success`, `data` (si válido) o `errors` (si inválido).
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

  // Formatear errores de Zod a strings legibles: "campo.subcampo: mensaje"
  const errors = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);

  return { success: false, errors };
}

/**
 * Crea un objeto comando vacío con los valores mínimos requeridos.
 *
 * CUÁNDO USAR:
 *   - En tests unitarios para crear comandos base sin repetir boilerplate.
 *   - Para inicializar formularios de edición de comandos en la UI.
 *
 * POR QUÉ `Partial<VoiceWorkOrderCommand>`:
 *   El objeto retornado no pasa la validación de Zod (confidence: 0, rawTranscript: '').
 *   Es solo un punto de partida para construir comandos en tests, no un comando válido.
 */
export function createEmptyCommand(): Partial<VoiceWorkOrderCommand> {
  return {
    action: 'create_work_order',
    confidence: 0,
    rawTranscript: '',
  };
}

/**
 * Determina si un comando requiere confirmación explícita del usuario antes de ejecutar.
 *
 * QUÉ HACE:
 *   Evalúa el comando contra criterios de riesgo para decidir si mostrar un
 *   diálogo de confirmación. La UI llama a esta función después de recibir
 *   el comando parseado y antes de llamar a executeCommand().
 *
 * CRITERIOS DE CONFIRMACIÓN (en orden de evaluación):
 *   1. Work orders urgentes o con asignación de técnico → alto impacto operativo.
 *   2. Comando 'logout' → acción irreversible en la sesión actual.
 *   3. Confianza < 0.85 → el parser no está suficientemente seguro de la intención.
 *      Este umbral es más alto que minConfidence (0.7) porque preferimos
 *      confirmar de más a ejecutar comandos incorrectos.
 *
 * @param command - Comando de voz tipado (ya pasó la validación de Zod).
 * @returns `true` si la UI debe mostrar un diálogo de confirmación antes de ejecutar.
 */
export function requiresConfirmation(command: VoiceCommand): boolean {
  if (command.type === 'work_order') {
    // Las OTs urgentes tienen impacto inmediato → confirmar
    // La asignación de técnico afecta la carga de trabajo de una persona → confirmar
    if (command.priority === 'urgent' || command.action === 'assign_technician') return true;
  }

  if (command.type === 'system') {
    // Logout cierra la sesión → siempre confirmar para evitar accidentes
    if (command.action === 'logout') return true;
  }

  // Confianza baja → la intención no está clara → mostrar el resumen al usuario
  if (command.confidence < 0.85) {
    return true;
  }

  return false;
}

/**
 * Genera un resumen legible del comando para mostrar en el diálogo de confirmación.
 *
 * QUÉ HACE:
 *   Convierte el objeto de comando técnico en una frase en español que el técnico
 *   puede leer para confirmar que el sistema interpretó correctamente su intención.
 *
 * FORMATO DE SALIDA:
 *   "Crear orden de trabajo para UMA en Edificio 3 (Prioridad: urgent)"
 *   "Navegar a Inventario"
 *   "Sistema: logout"
 *
 * @param command - Comando de voz tipado (ya pasó la validación de Zod).
 * @returns Frase descriptiva en español para mostrar en la UI de confirmación.
 */
export function formatCommandSummary(command: VoiceCommand): string {
  // Comandos de navegación: formato simple
  if (command.type === 'navigation') {
    return `Navegar a ${command.screen || command.path || 'destino'}`;
  }

  // Comandos de sistema: formato simple con la acción
  if (command.type === 'system') {
    return `Sistema: ${command.action}`;
  }

  // Comandos de Work Order: construir frase con los campos disponibles
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

  // Añadir equipo, ubicación y prioridad si están disponibles
  if (command.equipment) parts.push(`para ${command.equipment}`);
  if (command.location) parts.push(`en ${command.location}`);
  if (command.priority) parts.push(`(Prioridad: ${command.priority})`);

  return parts.join(' ');
}
