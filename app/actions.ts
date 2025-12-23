'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { VOICE_PROMPT, INVENTORY_PROMPT } from '@/app/config';
import {
  MAX_AUDIO_SIZE_MB,
  MAX_IMAGE_SIZE_MB,
  MAX_PDF_SIZE_MB,
  bytesToMB,
} from '@/app/config/limits';
import { logger } from '@/app/lib/logger';

/**
 * Calcula el tamaño aproximado de un string base64 en bytes
 */
function getBase64Size(base64: string): number {
  // Remover data URL prefix si existe
  const cleanBase64 = base64.split('base64,').pop() || base64;
  // Cada carácter base64 representa 6 bits, pero con padding, ~75% del tamaño string
  return (cleanBase64.length * 3) / 4;
}

/**
 * Transcribe un archivo de audio usando el modelo Gemini Flash Lite.
 * Utiliza prompting específico para limpiar timestamps y muletillas.
 *
 * @param audioDataUrl - String codificado en base64 del audio (data:audio/...)
 * @param mimeType - Tipo MIME del audio (default: 'audio/webm' para backward compatibility)
 * @returns Objeto con el texto transcrito y estado de éxito
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

// Analyze industrial part image for inventory
/**
 * Analiza una imagen de una pieza industrial para inventario.
 * Utiliza Gemini Vision para identificar, describir y evaluar el estado de la pieza.
 *
 * @param imageDataUrl - String codificado en base64 de la imagen
 * @param mediaType - Tipo MIME de la imagen (default: image/jpeg)
 * @param customPrompt - Prompt personalizado del usuario (opcional, usa INVENTORY_PROMPT por defecto)
 * @returns Descripción detallada generada por la IA
 */
export async function analyzePartImage(
  imageDataUrl: string,
  mediaType: string = 'image/jpeg',
  customPrompt?: string
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const base64Content = imageDataUrl.includes('base64,')
      ? imageDataUrl.split('base64,').pop() || ''
      : imageDataUrl;

    if (!base64Content) throw new Error('Imagen vacía');

    // Validar tamaño de la imagen
    const sizeInBytes = getBase64Size(base64Content);
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_IMAGE_SIZE_MB) {
      throw new Error(
        `Imagen demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_IMAGE_SIZE_MB}MB`
      );
    }

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      temperature: 0.2, // Un poco más de creatividad para descripciones
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: customPrompt || INVENTORY_PROMPT,
            },
            {
              type: 'file',
              data: base64Content,
              mediaType: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            },
          ],
        },
      ],
    });

    return { text: result.text, success: true };
  } catch (error: unknown) {
    logger.error(
      'Error análisis de imagen',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'actions', action: 'analyzePartImage' }
    );
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido de visión';
    return { text: '', success: false, error: errorMessage };
  }
}

/**
 * Analiza un documento PDF.
 * Utiliza Gemini para leer y analizar el contenido del documento.
 *
 * @param pdfDataUrl - String codificado en base64 del PDF
 * @param prompt - Prompt para el análisis (opcional)
 * @returns Análisis generado por la IA
 */
export async function analyzePdf(
  pdfDataUrl: string,
  prompt?: string
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const base64Content = pdfDataUrl.includes('base64,')
      ? pdfDataUrl.split('base64,').pop() || ''
      : pdfDataUrl;

    if (!base64Content) throw new Error('PDF vacío');

    // Validar tamaño del PDF
    const sizeInBytes = getBase64Size(base64Content);
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_PDF_SIZE_MB) {
      throw new Error(
        `PDF demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_PDF_SIZE_MB}MB`
      );
    }

    const result = await generateText({
      model: google('gemini-2.5-flash'), // Flash soporta hasta 1M tokens, ideal para PDFs
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt || 'Analiza este documento PDF y resume sus puntos clave.',
            },
            {
              type: 'file',
              data: base64Content,
              mediaType: 'application/pdf',
            },
          ],
        },
      ],
    });

    return { text: result.text, success: true };
  } catch (error: unknown) {
    logger.error(
      'Error análisis de PDF',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'actions',
        action: 'analyzePdf',
      }
    );
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al analizar PDF';
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
export async function executeVoiceCommand(
  transcript: string,
  options?: { minConfidence?: number; context?: string }
): Promise<
  | {
      success: true;
      command: {
        action: string;
        equipment?: string;
        location?: string;
        priority?: string;
        description?: string;
        assignee?: string;
        confidence: number;
        rawTranscript: string;
      };
    }
  | {
      success: false;
      error: string;
      code?: string;
      recoverable?: boolean;
    }
> {
  const { WORK_ORDER_VOICE_PROMPT } = await import('@/app/config/voice-command-prompt');
  const { VoiceWorkOrderCommandSchema } = await import('@/app/types/voice-commands');

  try {
    if (!transcript || transcript.trim().length < 3) {
      return {
        success: false,
        error: 'Transcripción vacía o demasiado corta',
        code: 'EMPTY_TRANSCRIPT',
        recoverable: true,
      };
    }

    const minConfidence = options?.minConfidence ?? 0.7;

    // Construir prompt con contexto opcional
    const contextPrompt = options?.context ? `\n\nCONTEXTO ADICIONAL: ${options.context}` : '';

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'),
      temperature: 0, // Determinístico para parsing
      messages: [
        {
          role: 'system',
          content: WORK_ORDER_VOICE_PROMPT + contextPrompt,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    });

    // Parsear JSON de la respuesta
    let parsed: unknown;
    try {
      // Limpiar posibles backticks de markdown
      const cleanJson = result.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      logger.warn('JSON inválido del modelo', {
        component: 'actions',
        action: 'executeVoiceCommand',
        rawResponse: result.text.slice(0, 200),
      });
      return {
        success: false,
        error: 'No se pudo interpretar el comando de voz',
        code: 'PARSE_ERROR',
        recoverable: true,
      };
    }

    // Validar con Zod
    const validation = VoiceWorkOrderCommandSchema.safeParse(parsed);

    if (!validation.success) {
      const errors = validation.error.issues
        .map((e: { path: PropertyKey[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');

      logger.warn('Validación Zod falló', {
        component: 'actions',
        action: 'executeVoiceCommand',
        errors,
      });

      return {
        success: false,
        error: `Comando inválido: ${errors}`,
        code: 'VALIDATION_ERROR',
        recoverable: true,
      };
    }

    // Verificar confianza mínima
    if (validation.data.confidence < minConfidence) {
      return {
        success: false,
        error: `Confianza insuficiente (${(validation.data.confidence * 100).toFixed(0)}% < ${(minConfidence * 100).toFixed(0)}%)`,
        code: 'LOW_CONFIDENCE',
        recoverable: true,
      };
    }

    logger.info('Comando de voz parseado', {
      component: 'actions',
      action: 'executeVoiceCommand',
      commandAction: validation.data.action,
      confidence: validation.data.confidence,
    });

    return {
      success: true,
      command: validation.data,
    };
  } catch (error: unknown) {
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
