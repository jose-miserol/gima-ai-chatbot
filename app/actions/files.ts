'use server';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

import { MAX_PDF_SIZE_MB, bytesToMB } from '@/app/config/limits';
import { logger } from '@/app/lib/logger';

/**
 * Analiza un documento PDF.
 * Utiliza Gemini para leer y analizar el contenido del documento.
 * @param formData - Objeto FormData que contiene el archivo 'file' y opcionalmente un 'prompt'
 * @returns Análisis generado por la IA
 */
export async function analyzePdf(
  formData: FormData
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;

    if (!file) throw new Error('PDF vacío');

    // Validar tamaño del PDF
    const sizeInBytes = file.size;
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_PDF_SIZE_MB) {
      throw new Error(
        `PDF demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_PDF_SIZE_MB}MB`
      );
    }

    const buffer = await file.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

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
