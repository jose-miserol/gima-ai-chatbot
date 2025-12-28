'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

import { ALLOWED_OPERATIONS } from '@/app/components/features/data-transformation/constants';
import { logger } from '@/app/lib/logger';
import {
  transformationActionSchema,
  transformationResponseSchema,
} from '@/app/lib/schemas/data-transformation.schema';

/**
 * Server Action para transformar datos usando Gemini.
 * Utiliza `generateObject` para asegurar una respuesta JSON estructurada y segura.
 * @param request Objeto con sourceData e instruction
 * @returns Resultado estructurado de la transformación
 */
export async function transformData(request: unknown) {
  const startTime = Date.now();

  try {
    // 1. Validar input
    const parseResult = transformationActionSchema.safeParse(request);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues.map((e) => e.message).join(', '),
      };
    }

    const { sourceData, instruction, context } = parseResult.data;

    // 2. Construir prompt
    const systemPrompt = `
      Eres un experto en Procesamiento y Transformación de Datos.
      Tu tarea es transformar los datos proporcionados siguiendo ESTRICTAMENTE las instrucciones del usuario.
      
      Operaciones permitidas: ${ALLOWED_OPERATIONS.join(', ')}.
      
      REGLAS DE SEGURIDAD:
      - NO inventes datos. Usa solo la información proporcionada.
      - Si la instrucción pide generar contenido falso o no relacionado con transformación, rechaza la operación.
      - Devuelve SIEMPRE un JSON válido coincidiendo con el schema output.
      - Si el input es CSV o Texto, paréalo correctamente a una estructura JSON lógica.
      
      Estructura de respuesta requerida:
      - success: boolean
      - data: (los datos transformados)
      - summary: (qué hiciste)
      - stats: { additions, deletions }
    `;

    // 3. Llamar a Gemini (usando configuración de mayor contexto)
    const { object: result } = await generateObject({
      model: google('gemini-2.5-flash'), // Context window 1M tokens
      schema: transformationResponseSchema,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `
            CONTEXTO ADICIONAL: ${context || 'Ninguno'}
            
            INSTRUCCIÓN: ${instruction}
            
            DATOS DE ORIGEN:
            \`\`\`
            ${sourceData.slice(0, 500000)} 
            \`\`\`
          `,
        },
      ],
      temperature: 0.1, // Baja temperatura para determinismo en datos
    });

    const durationMs = Date.now() - startTime;

    logger.info('Data transformation completed', {
      durationMs,
      stats: result.stats,
    });

    return {
      success: true,
      data: result.data,
      stats: {
        ...result.stats,
        durationMs,
        itemsProcessed: Array.isArray(result.data) ? result.data.length : 1,
      },
      diff: JSON.stringify(result.data, null, 2), // Simplificado para diff visual
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    logger.error(
      'Error in data transformation action',
      error instanceof Error ? error : new Error(String(error))
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno de transformación',
      timestamp: Date.now(),
    };
  }
}
