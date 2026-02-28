'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

import { INVENTORY_PROMPT } from '@/app/config';
import { MAX_IMAGE_SIZE_MB, bytesToMB } from '@/app/config/limits';
import { logger } from '@/app/lib/logger';

import { z } from 'zod';

/**
 * Esquema de respuesta estructurada para análisis de piezas
 * Basado en las entidades del backend (Articulo, Repuesto)
 */
export const partAnalysisSchema = z.object({
  tipo_articulo: z.enum(['mobiliario', 'equipo']).describe('Clasificación general del artículo'),
  codigo: z.string().optional().describe('Código identificado visible en la pieza'),
  descripcion: z.string().describe('Descripción detallada de la pieza o equipo'),
  marca: z.string().optional().describe('Marca del fabricante si es visible'),
  modelo: z.string().optional().describe('Modelo del equipo si es visible'),
  cantidad_detectada: z.number().describe('Cantidad de piezas de este tipo detectadas en la foto'),
  estado_fisico: z
    .enum(['nuevo', 'usado', 'dañado', 'requiere_inspeccion'])
    .describe('Condición visual de la pieza'),
  recomendacion: z
    .string()
    .describe('Recomendación breve sobre el manejo o mantenimiento de la pieza'),
  nivel_confianza: z
    .enum(['alta', 'media', 'baja'])
    .describe('Confianza de la IA sobre su identificación'),
});

export type PartAnalysisResult = z.infer<typeof partAnalysisSchema>;

/**
 * Analiza una imagen de una pieza industrial para inventario.
 * Utiliza Gemini Vision para identificar, describir y evaluar el estado de la pieza.
 * @param formData - FormData conteniendo el archivo 'file' y 'prompt' opcional
 * @returns Objeto estructurado generado por la IA en formato JSON
 */
export async function analyzePartImage(
  formData: FormData
): Promise<{ result: PartAnalysisResult | null; success: boolean; error?: string }> {
  try {
    const file = formData.get('file') as File | null;
    let customPrompt = formData.get('prompt') as string | null;

    if (!file) throw new Error('Imagen vacía');

    // Validar tamaño de la imagen
    const sizeInBytes = file.size;
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_IMAGE_SIZE_MB) {
      throw new Error(
        `Imagen demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_IMAGE_SIZE_MB}MB`
      );
    }

    const buffer = await file.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');
    const mediaType = file.type || 'image/jpeg';

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      temperature: 0.1, // Menor temperatura para forzar adherencia estricta al esquema
      schema: partAnalysisSchema,
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

    return { result: result.object, success: true };
  } catch (error: unknown) {
    logger.error(
      'Error análisis de imagen',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'actions', action: 'analyzePartImage' }
    );
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido de visión';
    return { result: null, success: false, error: errorMessage };
  }
}
