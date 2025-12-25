'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { VOICE_PROMPT } from '@/app/config';
import { MAX_AUDIO_SIZE_MB, bytesToMB } from '@/app/config/limits';
import { logger } from '@/app/lib/logger';
import { getBase64Size } from '@/app/utils/base64';
import { VoiceCommandParserService } from '@/app/lib/services/voice-command-parser';

/**
 * Transcribe un archivo de audio usando el modelo Gemini Flash Lite.
 * Utiliza prompting específico para limpiar timestamps y muletillas.
 *
 * @param audioDataUrl - String codificado en base64 del audio (data:audio/...)
 * @param mimeType - Tipo MIME del audio (default: 'audio/webm' para backward compatibility)
 * @returns Objeto con el texto transcrito y estado de éxito
 *
 * @example
 * ```typescript
 * const result = await transcribeAudio("data:audio/webm;base64,...");
 * if (result.success) {
 *   console.log("Transcripción:", result.text);
 * }
 * ```
 */
export async function transcribeAudio(
  audioDataUrl: string,
  mimeType: string = 'audio/webm'
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const base64Content = audioDataUrl.includes('base64,')
      ? audioDataUrl.split('base64,').pop() || ''
      : audioDataUrl;

    if (!base64Content) throw new Error('Audio vacío');

    // Validar tamaño del audio
    const sizeInBytes = getBase64Size(base64Content);
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_AUDIO_SIZE_MB) {
      throw new Error(
        `Audio demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_AUDIO_SIZE_MB}MB`
      );
    }

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: VOICE_PROMPT,
            },
            {
              type: 'file',
              data: base64Content,
              mediaType: mimeType,
            },
          ],
        },
      ],
    });

    // Limpieza por código: si el modelo manda por error "00:00", esto lo borra.
    const cleanText = result.text
      // Eliminar timestamps (00:00, 01:23, etc)
      .replace(/\d{1,2}:\d{2}/g, '')
      // Eliminar saltos de línea excesivos y unirlos con espacios
      .replace(/\n+/g, ' ')
      // Quitar espacios dobles que quedan al borrar los tiempos
      .replace(/\s+/g, ' ')
      .trim();

    return { text: cleanText, success: true };
  } catch (error: unknown) {
    logger.error('Error transcripción', error instanceof Error ? error : new Error(String(error)), {
      component: 'actions',
      action: 'transcribeAudio',
    });
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al transcribir';
    return { text: '', success: false, error: errorMessage };
  }
}

/**
 * Ejecuta un comando de voz parseando la transcripción y validando el resultado.
 * Usa Gemini para interpretar el comando y Zod para validar la estructura.
 *
 * @param transcript - Texto transcrito del audio de voz
 * @param options - Opciones de parsing (idioma, confianza mínima, contexto)
 * @returns Resultado discriminado con comando parseado o error
 *
 * @example
 * ```typescript
 * const result = await executeVoiceCommand("Crear orden urgente para la UMA");
 * if (result.success) {
 *   console.log(result.command.action); // 'create_work_order'
 * }
 * ```
 */

/**
 * Ejecuta un comando de voz parseando la transcripción y validando el resultado.
 * Delega la inteligencia al VoiceCommandParserService.
 */
export async function executeVoiceCommand(
  transcript: string,
  options?: { minConfidence?: number; context?: string }
) {
  try {
    const parser = VoiceCommandParserService.getInstance();
    const result = await parser.parseCommand(transcript, {
      minConfidence: options?.minConfidence ?? 0.7,
      context: options?.context,
      language: 'es-ES',
    });

    if (result.success && result.command) {
      return {
        success: true,
        command: result.command, // Ahora devuelve VoiceCommand (Union)
      } as const;
    }

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
      recoverable: false,
    };
  }
}
