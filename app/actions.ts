'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { VOICE_PROMPT, INVENTORY_PROMPT } from '@/app/config';

/**
 * Transcribe un archivo de audio usando el modelo Gemini Flash Lite.
 * Utiliza prompting específico para limpiar timestamps y muletillas.
 *
 * @param audioDataUrl - String codificado en base64 del audio (data:audio/...)
 * @returns Objeto con el texto transcrito y estado de éxito
 */
export async function transcribeAudio(
  audioDataUrl: string
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const base64Content = audioDataUrl.includes('base64,')
      ? audioDataUrl.split('base64,').pop() || ''
      : audioDataUrl;

    if (!base64Content) throw new Error('Audio vacío');

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
              mediaType: 'audio/webm',
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
    console.error('Error transcripción:', error);
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
    console.error('Error análisis de imagen:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido de visión';
    return { text: '', success: false, error: errorMessage };
  }
}
