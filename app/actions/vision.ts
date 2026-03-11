/**
 * @file vision.ts
 * @module app/actions/vision
 *
 * ============================================================
 * SERVER ACTION — ANÁLISIS DE IMÁGENES DE PIEZAS INDUSTRIALES
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la Server Action `analyzePartImage`, que recibe una fotografía
 *   de una pieza o equipo industrial y devuelve un objeto JSON estructurado
 *   con toda la información relevante para el módulo de inventario de GIMA:
 *   tipo, código, descripción, marca, modelo, estado físico, cantidad
 *   detectada, recomendación de manejo y nivel de confianza del modelo.
 *
 * CONTEXTO EN GIMA:
 *   Los operadores de bodega o técnicos de campo toman una foto con su
 *   dispositivo para identificar y registrar rápidamente una pieza sin
 *   necesidad de buscarla manualmente en catálogos.
 *   El resultado se pre-carga en el formulario de alta de inventario.
 *
 */

'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

// Prompt del sistema para análisis de inventario.
// Definido en app/config/index.ts — describe el contexto industrial de GIMA
// y las instrucciones específicas para identificar piezas con precisión.
import { INVENTORY_PROMPT } from '@/app/config';

// Constantes de límite de tamaño para archivos de imagen.
// MAX_IMAGE_SIZE_MB previene errores 413 en la API y abuso del sistema.
import { MAX_IMAGE_SIZE_MB, bytesToMB } from '@/app/config/limits';

// Logger centralizado para registro estructurado de errores.
import { logger } from '@/app/lib/logger';

import { z } from 'zod';

// ============================================================
// SCHEMA ZOD — Define la forma del objeto que Gemini debe generar
// ============================================================

/**
 * Schema de validación para el resultado del análisis de imagen.
 *
 * QUÉ ES:
 *   Contrato estricto entre Gemini y el sistema GIMA. Cada campo tiene
 *   un `.describe()` que actúa como instrucción adicional para el LLM,
 *   guiando qué información debe buscar en la imagen.
 *
 * POR QUÉ ZOD:
 *   - Validación en tiempo de ejecución (no solo TypeScript estático).
 *   - Los `.describe()` son usados por `generateObject` como parte del
 *     JSON Schema enviado a Gemini, mejorando la calidad de respuesta.
 *   - Si Gemini devuelve un campo inválido, Zod lo rechaza antes de
 *     que llegue al cliente.
 *
 * ENUMS USADOS:
 *   - tipo_articulo: 'mobiliario' | 'equipo'  (clasificación de alto nivel)
 *   - estado_fisico: 'nuevo' | 'usado' | 'dañado' | 'requiere_inspeccion'
 *   - nivel_confianza: 'alta' | 'media' | 'baja'  (auto-reporte del modelo)
 */
const partAnalysisSchema = z.object({
  // Clasificación general: si es un mueble (silla, escritorio) o equipo técnico
  tipo_articulo: z.enum(['mobiliario', 'equipo']).describe('Clasificación general del artículo'),

  // Código alfanumérico visible en la pieza (etiqueta, grabado, placa).
  // Opcional porque muchas piezas no tienen código visible.
  codigo: z.string().optional().describe('Código identificado visible en la pieza'),

  // Descripción completa para que un técnico entienda qué es la pieza
  descripcion: z.string().describe('Descripción detallada de la pieza o equipo'),

  // Marca del fabricante — opcional, no siempre visible en la foto
  marca: z.string().optional().describe('Marca del fabricante si es visible'),

  // Modelo del equipo — opcional, depende de que haya placa de datos visible
  modelo: z.string().optional().describe('Modelo del equipo si es visible'),

  // Cuántas unidades de esta pieza aparecen en la foto (puede ser > 1)
  cantidad_detectada: z.number().describe('Cantidad de piezas de este tipo detectadas en la foto'),

  // Estado visual actual de la pieza para decisiones de compra/reparación
  estado_fisico: z
    .enum(['nuevo', 'usado', 'dañado', 'requiere_inspeccion'])
    .describe('Condición visual de la pieza'),

  // Acción sugerida: "Limpiar contactos", "Almacenar en lugar seco", etc.
  recomendacion: z
    .string()
    .describe('Recomendación breve sobre el manejo o mantenimiento de la pieza'),

  // El modelo reporta qué tan seguro está de su propia identificación.
  // 'baja' es señal para que el operador revise manualmente.
  nivel_confianza: z
    .enum(['alta', 'media', 'baja'])
    .describe('Confianza de la IA sobre su identificación'),
});

/**
 * Tipo TypeScript inferido automáticamente del schema Zod.
 * Se usa como tipo de retorno para garantizar coherencia entre
 * el schema de validación y la interfaz TypeScript.
 */
type PartAnalysisResult = z.infer<typeof partAnalysisSchema>;

// ============================================================
// SERVER ACTION: analyzePartImage
// ============================================================

/**
 * Analiza una imagen de una pieza industrial para el módulo de inventario.
 *
 * QUÉ HACE:
 *   Recibe una imagen vía FormData, la envía a Gemini Vision con el schema
 *   de inventario y devuelve un objeto tipado con toda la información
 *   identificada en la foto.
 *
 * CÓMO FUNCIONA (paso a paso):
 *   1. Extrae el archivo y el prompt opcional del FormData.
 *   2. Valida que la imagen no supere MAX_IMAGE_SIZE_MB.
 *   3. Convierte la imagen a base64 (requerido por la API de Gemini).
 *   4. Llama a `generateObject` con el schema Zod — Gemini devuelve JSON
 *      que es automáticamente validado antes de retornarlo.
 *   5. Retorna { result, success } o { result: null, success: false, error }.
 *
 * POR QUÉ FormData Y NO JSON:
 *   Los archivos binarios (imágenes) no se pueden enviar directamente como
 *   JSON en Server Actions. FormData es el mecanismo nativo de Next.js 15
 *   para transferir archivos al servidor.
 *
 * QUIÉN LA LLAMA:
 *   El componente ImageAnalyzer de la feature de inventario.
 *   Típicamente disparado cuando el usuario selecciona o captura una foto.
 *
 * @param formData - FormData con:
 *   - 'file'   (File, requerido): imagen de la pieza (JPEG, PNG, WebP).
 *   - 'prompt' (string, opcional): instrucción personalizada para el análisis.
 *              Si se omite, usa INVENTORY_PROMPT por defecto.
 * @returns Objeto con el resultado estructurado y bandera de éxito.
 */
export async function analyzePartImage(
  formData: FormData
): Promise<{ result: PartAnalysisResult | null; success: boolean; error?: string }> {
  try {
    // Paso 1: Extraer campos del FormData.
    // TypeScript requiere el cast explícito porque FormData.get() retorna
    // `FormDataEntryValue | null` (string | File | null).
    const file = formData.get('file') as File | null;
    let customPrompt = formData.get('prompt') as string | null;

    if (!file) throw new Error('Imagen vacía');

    // Paso 2: Validar tamaño de la imagen.
    // Imágenes muy grandes consumen muchos tokens del contexto multimodal.
    // Un archivo de 20MB podría agotar la cuota diaria de la API.
    const sizeInBytes = file.size;
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_IMAGE_SIZE_MB) {
      throw new Error(
        `Imagen demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_IMAGE_SIZE_MB}MB`
      );
    }

    // Paso 3: Convertir imagen a base64.
    // arrayBuffer() lee el binario completo; Buffer.toString('base64')
    // lo codifica en el formato que espera la API de Gemini.
    const buffer = await file.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

    // Paso 4: Llamar a Gemini con schema estructurado.
    // `generateObject` envía el schema Zod como JSON Schema al modelo,
    // que lo usa como guía para formatear su respuesta.
    // Si la respuesta no cumple el schema, lanza un error antes de retornar.
    const result = await generateObject({
      model: google('gemini-2.5-flash'), // Flash: capacidad multimodal + contexto largo
      temperature: 0.1, // Baja creatividad → mayor precisión en datos de inventario
      schema: partAnalysisSchema, // El contrato que Gemini debe respetar
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              // Si el operador proporciona un prompt específico (ej. "identifica el número de serie"),
              // se usa ese. De lo contrario, el prompt estándar de inventario GIMA.
              text: customPrompt || INVENTORY_PROMPT,
            },
            {
              type: 'image',
              image: base64Content, // Imagen en base64 sin el prefijo data:image/...
            },
          ],
        },
      ],
    });

    // result.object está completamente tipado como PartAnalysisResult gracias al schema
    return { result: result.object, success: true };
  } catch (error: unknown) {
    logger.error(
      'Error análisis de imagen',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'actions', action: 'analyzePartImage' }
    );
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido de visión';
    // Se retorna null en result para que el componente UI pueda detectar
    // el fallo sin necesidad de hacer un type narrowing complejo.
    return { result: null, success: false, error: errorMessage };
  }
}
