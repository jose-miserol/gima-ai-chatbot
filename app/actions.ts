'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { VOICE_PROMPT, INVENTORY_PROMPT } from '@/app/config';
import { MAX_AUDIO_SIZE_MB, MAX_IMAGE_SIZE_MB, bytesToMB } from '@/app/config/limits';
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
 * @returns Descripción detallada generada por la IA
 */
export async function analyzePartImage(
  imageDataUrl: string,
  mediaType: string = 'image/jpeg'
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
              text: INVENTORY_PROMPT,
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
