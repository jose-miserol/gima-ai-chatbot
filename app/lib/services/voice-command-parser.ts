/**
 * @file voice-command-parser.ts
 * @module app/lib/services/voice-command-parser
 *
 * ============================================================
 * SERVICIO — PARSER DE COMANDOS DE VOZ CON GEMINI
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `VoiceCommandParserService`, un singleton que toma texto
 *   libre (transcripción del audio del usuario) y lo convierte en un
 *   objeto `VoiceCommand` estructurado y validado con Zod.
 *
 *   El parser identifica la intención del usuario (crear OT, consultar
 *   inventario, revisar calendario, etc.), extrae entidades relevantes
 *   (equipo, prioridad, sede, tipo de tarea) y asigna un score de confianza
 *   [0-1] que permite rechazar comandos ambiguos antes de ejecutarlos.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos de campo trabajan con guantes o con las manos ocupadas,
 *   haciendo impracticable teclear comandos. La interfaz de voz permite
 *   dictar órdenes como "Crear orden urgente para el compresor del edificio B"
 *   o "¿Cuántos filtros de aceite quedan en bodega?". Este servicio es el
 *   cerebro que convierte esa intención en datos accionables.
 *
 *   El flujo completo es:
 *   [micrófono] → transcribeAudio (voice.ts) → parseCommand (este módulo)
 *   → executeVoiceCommand (voice.ts) → WorkOrderService / BackendAPIService
 *
 * POR QUÉ GEMINI FLASH LITE Y NO GROQ:
 *   El parsing de comandos requiere seguir fielmente un schema JSON estricto
 *   (VoiceCommandSchema). Gemini Flash Lite, aunque más lento que GROQ,
 *   tiene mejor instrucciones-following para output JSON estructurado.
 *   Además, el parsing ocurre una sola vez por comando (no en streaming),
 *   por lo que la latencia adicional (~300ms) es aceptable.
 *
 * POR QUÉ SINGLETON:
 *   VoiceCommandParserService inicializa el cliente de Gemini y la
 *   configuración de BaseAIService una sola vez. Reutilizar la instancia
 *   evita overhead de inicialización en cada comando y mantiene el estado
 *   del logger consistente a lo largo de la sesión.
 *   Se accede a la instancia via `VoiceCommandParserService.getInstance()`.
 *
 * VALIDACIÓN DE CONFIANZA:
 *   Gemini retorna un campo `confidence` [0-1] en el JSON. Si el valor
 *   está por debajo de `minConfidence` (default 0.7), el servicio retorna
 *   `success: false` aunque el parsing técnico haya sido correcto. Esto
 *   permite a la UI mostrar un "¿Quisiste decir...?" en lugar de ejecutar
 *   un comando potencialmente incorrecto.
 *
 * TEMPERATURA 0:
 *   El parsing de intenciones debe ser completamente determinista: el mismo
 *   texto siempre debe producir el mismo comando. temperature=0 elimina
 *   toda aleatoriedad del modelo.
 *
 */

import { google } from '@ai-sdk/google';
import { generateText, type LanguageModel } from 'ai';

import { MASTER_VOICE_PROMPT } from '@/app/config/prompts/voice-master-prompt';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import {
  VoiceCommandSchema,
  type VoiceCommand,
  type VoiceParserOptions,
} from '@/app/types/voice-commands';

// ============================================================
// SERVICIO: VoiceCommandParserService
// ============================================================

/**
 * Servicio singleton para parsear texto libre a comandos de voz estructurados.
 *
 * Extiende `BaseAIService` para heredar retry logic y logging estructurado.
 * No usa el cache de BaseAIService porque los comandos de voz son únicos
 * por naturaleza (mismo texto, diferente contexto o momento → diferente intención).
 *
 * @example
 * ```typescript
 * const parser = VoiceCommandParserService.getInstance();
 * const result = await parser.parseCommand(
 *   "Crear orden urgente para el compresor del edificio B",
 *   { minConfidence: 0.7, context: 'work-orders' }
 * );
 *
 * if (result.success && result.command) {
 *   await workOrderService.create(result.command);
 * }
 * ```
 */
export class VoiceCommandParserService extends BaseAIService {
  /** Instancia única del servicio (patrón Singleton). */
  private static instance: VoiceCommandParserService;

  /** Modelo de Gemini Flash Lite para parsing de intenciones. */
  private model: LanguageModel;

  /**
   * Constructor privado — usar `getInstance()` para obtener la instancia.
   * Inicializa el modelo de Gemini y la configuración base del servicio.
   */
  private constructor() {
    super({
      serviceName: 'VoiceCommandParser',
      // No se configura cache porque los comandos de voz son únicos.
      // No se configura timeoutMs ni maxRetries → se usan los defaults de BaseAIService.
    });
    this.model = google('gemini-2.5-flash-lite'); // Flash Lite: mejor JSON compliance, latencia aceptable
  }

  /**
   * Retorna la instancia singleton del parser, creándola si no existe.
   *
   * CUÁNDO LLAMARLO:
   *   Desde `executeVoiceCommand` (voice.ts) justo antes de parsear.
   *   No instanciar directamente con `new` — el constructor es privado.
   *
   * @returns La instancia única de VoiceCommandParserService.
   */
  public static getInstance(): VoiceCommandParserService {
    if (!VoiceCommandParserService.instance) {
      VoiceCommandParserService.instance = new VoiceCommandParserService();
    }
    return VoiceCommandParserService.instance;
  }

  /**
   * Parsea texto libre a un comando estructurado y validado.
   *
   * QUÉ HACE (paso a paso):
   *   1. Valida que la transcripción tenga al menos 2 caracteres.
   *   2. Construye el prompt del sistema con contexto opcional de la app.
   *   3. Llama a Gemini con temperature=0 para obtener JSON determinista.
   *   4. Limpia el JSON de posibles bloques markdown (```json ... ```).
   *   5. Valida el JSON contra VoiceCommandSchema con Zod.
   *   6. Comprueba que el confidence score supere minConfidence.
   *   7. Retorna { success, command } o { success: false, error }.
   *
   * NOTA SOBRE CONFIANZA BAJA:
   *   Si confidence < minConfidence, se retorna `success: false` pero
   *   el campo `command` se incluye igualmente. Esto permite que la UI
   *   muestre un "¿Quisiste decir X?" con el comando detectado para que
   *   el usuario confirme antes de ejecutar.
   *
   * @param transcript    - Texto transcrito del audio del usuario.
   * @param options       - Configuración del parsing.
   * @param options.minConfidence - Umbral mínimo [0-1]. Default 0.7.
   *                                Valores < 0.7 producen más falsos positivos.
   * @param options.context       - Módulo activo en la app (ej. 'work-orders',
   *                                'inventory'). Se inyecta en el prompt para
   *                                mejorar la disambiguación contextual.
   * @param options.language      - Idioma del transcript (ej. 'es-ES').
   *                                Actualmente no usado en el modelo pero
   *                                disponible para normalización futura.
   * @returns Objeto con `success`, `command` (si éxito) y `error` (si fallo).
   */
  public async parseCommand(
    transcript: string,
    options?: VoiceParserOptions
  ): Promise<{ success: boolean; command?: VoiceCommand; error?: string }> {
    // Guardia temprana: transcripciones muy cortas no tienen suficiente
    // información para inferir una intención con fiabilidad.
    if (!transcript || transcript.trim().length < 2) {
      return { success: false, error: 'Transcripción demasiado corta' };
    }

    const minConfidence = options?.minConfidence ?? 0.7;
    // Inyectar contexto del módulo activo en el prompt del sistema.
    // Ejemplo: si el usuario está en el módulo de inventario, "¿Cuántos hay?"
    // se interpreta como consulta de stock, no de OTs pendientes.
    const contextPrompt = options?.context ? `\nCONTEXTO ACTUAL APP: ${options.context}` : '';

    try {
      this.deps.logger?.info('Parsing voice command', { length: transcript.length });

      // Llamar a Gemini con temperatura 0 para output JSON determinista.
      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: MASTER_VOICE_PROMPT + contextPrompt,
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0, // Sin aleatoriedad — mismo input siempre produce mismo output
      });

      // Limpiar posibles bloques de código markdown que el modelo incluya
      // aunque el prompt especifique "responde solo con JSON".
      const cleanJson = result.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Parsear JSON — separado del try principal para distinguir errores de parsing
      // (bug del modelo) de errores de red (problema de conectividad).
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        this.deps.logger?.warn('Invalid JSON from AI', { response: result.text.slice(0, 100) });
        return { success: false, error: 'Error interno de parsing (JSON)' };
      }

      // Validar contra VoiceCommandSchema con Zod.
      // Si el modelo omitió campos requeridos, la validación falla aquí
      // y se retorna error descriptivo en lugar de propagar un tipo incorrecto.
      const validation = VoiceCommandSchema.safeParse(parsed);

      if (!validation.success) {
        const errors = validation.error.issues.map((i) => `${i.path}: ${i.message}`).join(', ');
        this.deps.logger?.warn('Schema validation failed', { errors });
        return { success: false, error: `Comando no reconocido: ${errors}` };
      }

      const command = validation.data;

      // Comprobar umbral de confianza del modelo.
      // Se retorna el comando igualmente para que la UI pueda ofrecer confirmación.
      if (command.confidence < minConfidence) {
        this.deps.logger?.info('Confidence check failed', {
          got: command.confidence,
          required: minConfidence,
        });
        return {
          success: false,
          error: 'No entendí el comando con suficiente claridad.',
          command, // Disponible para "¿Quisiste decir...?" en la UI
        };
      }

      this.deps.logger?.info('Command parsed successfully', {
        type: command.type,
        action: command.action,
      });

      return { success: true, command };
    } catch (error) {
      this.deps.logger?.error('Error in parseCommand', error as Error);
      return { success: false, error: 'Error al procesar el comando' };
    }
  }
}
