'use server';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

import { INVENTORY_PROMPT } from '@/app/config';
import { MAX_IMAGE_SIZE_MB, bytesToMB } from '@/app/config/limits';
import { logger } from '@/app/lib/logger';
import { getBase64Size } from '@/app/utils/base64';

/**
 * Analiza una imagen de una pieza industrial para inventario.
 * Utiliza Gemini Vision para identificar, describir y evaluar el estado de la pieza.
 * @param imageDataUrl - String codificado en base64 de la imagen
 * @param mediaType - Tipo MIME de la imagen (default: image/jpeg)
 * @param customPrompt - Prompt personalizado del usuario (opcional, usa INVENTORY_PROMPT por defecto)
 * @returns Descripción detallada generada por la IA
 * @example
 * ```typescript
 * const result = await analyzePartImage("data:image/jpeg;base64,...");
 * if (result.success) {
 *   console.log("Descripción:", result.text);
 * }
 * ```
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
