/**
 * @file data-transformation.ts
 * @module app/actions/data-transformation
 *
 * ============================================================
 * SERVER ACTION — TRANSFORMACIÓN INTELIGENTE DE DATOS CON IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la Server Action `transformData`, que permite convertir,
 *   limpiar, normalizar o reestructurar datos en múltiples formatos
 *   (CSV, JSON, texto plano) siguiendo instrucciones en lenguaje natural.
 *
 * CASOS DE USO EN GIMA:
 *   - Importar un CSV de proveedores con columnas inconsistentes y
 *     normalizarlo al esquema de inventario GIMA.
 *   - Convertir una lista de equipos en texto libre a JSON estructurado.
 *
 * ARQUITECTURA DE SEGURIDAD:
 *   Esta action aplica múltiples capas de defensa para prevenir abusos:
 *   1. Validación Zod del input antes de llamar a la IA.
 *   2. Lista blanca de ALLOWED_OPERATIONS (limitar el alcance de lo que la IA puede hacer con los datos) en el system prompt.
 *   3. Instrucción explícita al modelo de rechazar contenido falso/irrelevante.
 *   4. `generateObject` con schema Zod para respuesta → imposible inyectar
 *      HTML, scripts u otras salidas no estructuradas.
 *   5. Truncado del input a 500,000 caracteres (límite de contexto seguro).
 *
 * POR QUÉ GEMINI 2.5 FLASH (no Pro ni otro):
 *   - Contexto de 1M tokens: puede procesar datasets grandes sin fragmentar.
 *   - Velocidad superior a Pro para transformaciones en tiempo real.
 *   - Temperature 0.1: respuestas deterministas, crítico para manejo de datos.
 *
 * DÓNDE SE CONSUME:
 *   - app/components/features/ai-tools/data-transformation/
 */

'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

// Lista blanca de operaciones permitidas (filtrar, ordenar, convertir, etc.)
// Definida en la feature de data-transformation para mantener la lógica
// de negocio cerca de la UI que la usa.
import { ALLOWED_OPERATIONS } from '@/app/components/features/ai-tools/data-transformation/constants';

// Logger estructurado del proyecto para registro de operaciones y errores.
import { logger } from '@/app/lib/logger';

// Schemas Zod para validar tanto el input del usuario como la respuesta del modelo.
// - transformationActionSchema: valida { sourceData, instruction, context? }
// - transformationResponseSchema: define la estructura que Gemini debe producir
import {
  transformationActionSchema,
  transformationResponseSchema,
} from '@/app/lib/schemas/data-transformation.schema';

// ============================================================
// SERVER ACTION: transformData
// ============================================================

/**
 * Transforma datos usando Gemini con validación estricta de entrada y salida.
 *
 * QUÉ HACE:
 *   Recibe datos en bruto y una instrucción en lenguaje natural, valida el
 *   input con Zod, construye un prompt de sistema seguro y llama a Gemini
 *   para que produzca los datos transformados en formato JSON estructurado.
 *   Retorna el resultado junto con estadísticas de la operación.
 *
 * CÓMO FUNCIONA:
 *   1. Valida el input con `transformationActionSchema` (Zod safeParse).
 *      Si es inválido, retorna inmediatamente con el error de validación.
 *   2. Construye un system prompt con las reglas de seguridad y la lista
 *      de operaciones permitidas (ALLOWED_OPERATIONS).
 *   3. Llama a `generateObject` con Gemini Flash y `transformationResponseSchema`.
 *      El input se trunca a 500,000 caracteres para controlar el costo de tokens.
 *   4. Calcula métricas de rendimiento (durationMs, itemsProcessed).
 *   5. Retorna el objeto transformado + stats, o un error tipado en caso de fallo.
 *
 * DISEÑO DEL SYSTEM PROMPT:
 *   El prompt incluye:
 *   - Rol del modelo: "experto en Procesamiento y Transformación de Datos"
 *   - ALLOWED_OPERATIONS como restricción explícita de lo que puede hacer
 *   - Reglas anti-alucinación: "NO inventes datos"
 *   - Estructura de respuesta requerida (alineada con transformationResponseSchema)
 *   Este diseño es intencional: cuanto más explícito sea el prompt, más
 *   predecible y segura es la salida del modelo.
 *
 * QUIÉN LA LLAMA:
 *   El componente DataTransformationTool en la sección de herramientas de IA.
 *   Recibe el input del usuario desde un editor de texto/código en la UI.
 *
 * @param request - Objeto sin tipo (se valida internamente con Zod).
 *                  Se espera: { sourceData: string, instruction: string, context?: string }
 *                  El tipo `unknown` permite que cualquier componente lo invoque
 *                  sin acoplarse al schema — la validación ocurre aquí.
 * @returns Resultado estructurado de la transformación o error descriptivo.
 */
export async function transformData(request: unknown) {
  // Marca de tiempo inicial para calcular duración total de la operación.
  // Se mide desde el inicio de la función, no desde la llamada a la IA,
  // para incluir el tiempo de validación en la métrica total.
  const startTime = Date.now();

  try {
    // Paso 1: Validar input con Zod usando safeParse (no lanza excepciones).
    // Usar `safeParse` en lugar de `parse` permite devolver un error amigable
    // al cliente sin necesidad de un try/catch adicional para la validación.
    const parseResult = transformationActionSchema.safeParse(request);
    if (!parseResult.success) {
      return {
        success: false,
        // Concatenar todos los mensajes de error de Zod en un solo string legible
        error: parseResult.error.issues.map((e) => e.message).join(', '),
      };
    }

    const { sourceData, instruction, context } = parseResult.data;

    // Paso 2: Construir system prompt con reglas de seguridad y contexto de negocio.
    // El prompt tiene 3 secciones clave:
    // A) Definición del rol (quién es el modelo en esta tarea)
    // B) Lista blanca de operaciones permitidas (seguridad)
    // C) Reglas de seguridad explícitas (anti-alucinación, anti-inyección)
    // D) Estructura de respuesta requerida (alineada con el schema Zod)
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

    // Paso 3: Llamar a Gemini con schema estructurado.
    // Se usa `generateObject` (no `generateText`) para garantizar que la
    // respuesta sea JSON válido que pase la validación de `transformationResponseSchema`.
    // El truncado a 500,000 caracteres protege contra datasets masivos que podrían
    // agotar el presupuesto de tokens o causar timeouts.
    const { object: result } = await generateObject({
      model: google('gemini-2.5-flash'), // Contexto de 1M tokens — soporta datasets grandes
      schema: transformationResponseSchema, // Contrato de respuesta que Gemini debe cumplir
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
      temperature: 0.1, // Temperatura baja = respuestas deterministas y precisas para datos
    });

    // Paso 4: Calcular métricas de rendimiento.
    const durationMs = Date.now() - startTime;

    // Registrar stats en el logger para monitoreo de uso y performance.
    // Útil para detectar transformaciones lentas o datasets anómalos.
    logger.info('Data transformation completed', {
      durationMs,
      stats: result.stats,
    });

    // Paso 5: Retornar resultado enriquecido con métricas.
    return {
      success: true,
      data: result.data,
      stats: {
        ...result.stats, // additions y deletions reportados por el modelo
        durationMs, // Tiempo total medido en el servidor
        // Si el resultado es un array, contar sus elementos; si es objeto único → 1
        itemsProcessed: Array.isArray(result.data) ? result.data.length : 1,
      },
      // `diff` es una representación legible de los datos transformados.
      // El componente de UI lo usa para mostrar una vista de "antes/después".
      diff: JSON.stringify(result.data, null, 2),
      timestamp: Date.now(), // Para que el cliente pueda mostrar "hace X segundos"
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
