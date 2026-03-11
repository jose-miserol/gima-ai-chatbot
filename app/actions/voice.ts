/**
 * @file voice.ts
 * @module app/actions/voice
 *
 * ============================================================
 * SERVER ACTION — TRANSCRIPCIÓN DE VOZ Y COMANDOS DE VOZ
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone dos Server Actions de Next.js para el sistema de voz de GIMA:
 *   1. `transcribeAudio`    → Convierte audio grabado a texto limpio.
 *   2. `executeVoiceCommand`→ Interpreta ese texto como un comando del sistema
 *                             (ej. "Crear orden urgente para la UMA").
 *
 * CONTEXTO:
 *   Los técnicos de campo pueden dictar comandos en lugar de tipearlos.
 *   El flujo es: [micrófono del navegador] → transcribeAudio → executeVoiceCommand
 *   → acción en el sistema (crear OT, consultar inventario, etc.)
 *
 */

'use server';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// Prompt del sistema para guiar a Gemini en la transcripción
// Definido en app/config/index.ts — contiene instrucciones para omitir
// muletillas, eliminar timestamps y mantener el idioma original (es-MX/es-ES).
import { VOICE_PROMPT } from '@/app/config';

// Límites de tamaño de archivo definidos globalmente para todos los módulos de IA.
// MAX_AUDIO_SIZE_MB evita consumo excesivo de tokens y errores de la API.
import { MAX_AUDIO_SIZE_MB, bytesToMB } from '@/app/config/limits';

// Logger centralizado del proyecto. En producción escribe a un servicio externo;
// en desarrollo imprime en consola con formato estructurado.
import { logger } from '@/app/lib/logger';

// Servicio singleton que encapsula la lógica de parsing de comandos de voz.
// Usa Gemini + Zod para interpretar y validar la intención del usuario.
import { VoiceCommandParserService } from '@/app/lib/services/voice-command-parser';

// Utilidad para calcular el tamaño real de un string base64 en bytes
// (el string base64 es ~33% más grande que el binario original).
import { getBase64Size } from '@/app/utils/base64';

// ============================================================
// ACTION 1: transcribeAudio
// ============================================================

/**
 * Transcribe un archivo de audio usando Gemini Flash Lite.
 *
 * QUÉ HACE:
 *   Recibe audio codificado en base64, lo envía a Gemini para transcripción
 *   y devuelve el texto limpio (sin timestamps ni muletillas).
 *
 * CÓMO FUNCIONA (paso a paso):
 *   1. Extrae el contenido base64 puro del data URL (si existe el prefijo).
 *   2. Valida que el archivo no supere MAX_AUDIO_SIZE_MB.
 *   3. Llama a Gemini Flash Lite con temperatura 0 (máxima precisión).
 *   4. Limpia el resultado: elimina timestamps (00:00), normaliza espacios.
 *   5. Retorna { text, success } o { text: '', success: false, error }.
 *
 *
 * @param audioDataUrl - String base64 del audio. Puede incluir el prefijo
 *                       `data:audio/webm;base64,` o ser base64 puro.
 * @param mimeType     - MIME type del audio (default 'audio/webm' para
 *                       compatibilidad con MediaRecorder del navegador).
 * @returns Objeto con el texto transcrito y bandera de éxito.
 *
 */

export async function transcribeAudio(
  audioDataUrl: string,
  mimeType: string = 'audio/webm'
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    // Paso 1: Extraer base64 puro del data URL.
    // El navegador entrega el audio como "data:audio/webm;base64,<contenido>".
    // Gemini espera solo el contenido base64, sin el prefijo descriptivo.
    const base64Content = audioDataUrl.includes('base64,')
      ? audioDataUrl.split('base64,').pop() || ''
      : audioDataUrl;

    if (!base64Content) throw new Error('Audio vacío');

    // Paso 2: Validar tamaño.
    // getBase64Size calcula bytes reales (base64 infla ~33% el tamaño original).
    // Superar MAX_AUDIO_SIZE_MB causaría un error 400 en la API de Gemini.
    const sizeInBytes = getBase64Size(base64Content);
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_AUDIO_SIZE_MB) {
      throw new Error(
        `Audio demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_AUDIO_SIZE_MB}MB`
      );
    }

    // Paso 3: Llamar a Gemini Flash Lite para transcripción.
    // Se usa `generateText` (no `generateObject`) porque la respuesta
    // es texto libre, no un esquema estructurado.
    // temperature: 0 → sin aleatoriedad, reproducibilidad máxima.
    const result = await generateText({
      model: google('gemini-2.5-flash-lite'), // Versión lite: más económica.
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: VOICE_PROMPT, // Instrucciones: "transcribe sin muletillas ni timestamps"
            },
            {
              type: 'file',
              data: base64Content,
              mediaType: mimeType, // Informa al modelo el codec del audio
            },
          ],
        },
      ],
    });

    // Paso 4: Post-procesamiento por código.
    // Aunque el prompt instruye al modelo a no incluir timestamps, esta limpieza
    // es una segunda capa de defensa ante comportamientos inesperados del LLM.
    const cleanText = result.text
      .replace(/\d{1,2}:\d{2}/g, '') // Eliminar timestamps tipo "00:00" o "1:23"
      .replace(/\n+/g, ' ') // Colapsar saltos de línea múltiples a un espacio
      .replace(/\s+/g, ' ') // Eliminar espacios dobles residuales
      .trim();

    return { text: cleanText, success: true };
  } catch (error: unknown) {
    // Registrar con contexto para facilitar debug en logs de producción
    logger.error('Error transcripción', error instanceof Error ? error : new Error(String(error)), {
      component: 'actions',
      action: 'transcribeAudio',
    });
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al transcribir';
    return { text: '', success: false, error: errorMessage };
  }
}

// ============================================================
// ACTION 2: executeVoiceCommand
// ============================================================

/**
 * Interpreta y ejecuta un comando de voz a partir de texto transcrito.
 *
 * QUÉ HACE:
 *   Toma la transcripción de `transcribeAudio` y la pasa al
 *   VoiceCommandParserService, que usa Gemini para identificar la intención
 *   del usuario (ej. "crear orden de trabajo", "consultar stock") y valida
 *   la respuesta con Zod antes de devolverla al cliente.
 *
 * CÓMO FUNCIONA (paso a paso):
 *   1. Verifica que GOOGLE_GENERATIVE_AI_API_KEY esté configurada.
 *      (Falla rápido y controlado — sin API key no tiene sentido continuar.)
 *   2. Obtiene la instancia singleton del VoiceCommandParserService.
 *   3. Llama a parser.parseCommand() con umbral de confianza mínima.
 *   4. Si el parsing es exitoso, retorna { success: true, command }.
 *   5. Si falla, retorna un objeto de error con código y flag de recuperabilidad.
 *
 * CÓDIGOS DE ERROR POSIBLES:
 *   - MISSING_API_KEY  → Variable de entorno no configurada. No recuperable.
 *   - PARSING_FAILED   → Gemini no pudo inferir la intención. Recuperable (reintentar).
 *   - EXECUTION_ERROR  → Error de red u otro inesperado. No recuperable.
 *
 * @param transcript     - Texto transcrito del audio del usuario.
 * @param options        - Configuración opcional del parser.
 * @param options.minConfidence - Umbral mínimo de confianza [0-1]. Default 0.7.
 *                                Valores < 0.7 pueden producir comandos incorrectos.
 * @param options.context       - Contexto adicional para el parser (ej. módulo activo).
 */

export async function executeVoiceCommand(
  transcript: string,
  options?: { minConfidence?: number; context?: string }
) {
  // Paso 1: Verificar API Key antes de hacer cualquier llamada.
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    logger.error(
      'API Key de Google AI no configurada',
      new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY'),
      {
        component: 'actions',
        action: 'executeVoiceCommand',
      }
    );
    return {
      success: false,
      error:
        'La API Key de Google AI no está configurada. Verifica la variable de entorno GOOGLE_GENERATIVE_AI_API_KEY.',
      code: 'MISSING_API_KEY',
      recoverable: false,
    };
  }

  try {
    // Paso 2 y 3: Delegar al servicio de parsing.
    // VoiceCommandParserService encapsula: llamada a Gemini, parseo de respuesta,
    // validación Zod del comando resultante y manejo de errores del LLM.
    const parser = VoiceCommandParserService.getInstance();
    const result = await parser.parseCommand(transcript, {
      minConfidence: options?.minConfidence ?? 0.7, // 70% de confianza mínima por defecto
      context: options?.context,
      language: 'es-ES', // Forzar español de España para normalización del parser
    });

    // Paso 4: Éxito — devolver el comando validado por Zod (tipo VoiceCommand union).
    // El `as const` asegura que TypeScript infiera el tipo literal de `success: true`,
    // habilitando discriminated union en el lado del cliente.
    if (result.success && result.command) {
      return {
        success: true,
        command: result.command,
      } as const;
    }

    // Paso 5: El servicio no encontró un comando válido (baja confianza, intención ambigua).
    // Se marca como recuperable para que la UI pueda pedir al usuario que repita.
    return {
      success: false,
      error: result.error || 'No se pudo procesar el comando',
      code: 'PARSING_FAILED',
      recoverable: true,
    };
  } catch (error) {
    logger.error(
      'Error ejecutando comando de voz',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'actions', action: 'executeVoiceCommand' }
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      code: 'EXECUTION_ERROR',
      recoverable: false, // Error de red u inesperado → no reintentar automáticamente
    };
  }
}
