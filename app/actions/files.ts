/**
 * @file files.ts
 * @module app/actions/files
 *
 * ============================================================
 * SERVER ACTION — ANÁLISIS DE DOCUMENTOS PDF
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la Server Action `analyzePdf`, que recibe un archivo PDF
 *   (manual técnico, reporte de mantenimiento, ficha de equipo, etc.)
 *   y retorna un análisis de texto generado por Gemini Flash.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos frecuentemente necesitan consultar manuales de fabricantes
 *   o reportes históricos en PDF. En lugar de leer el documento completo,
 *   pueden hacer una pregunta específica (ej. "¿Cuál es el torque de ajuste
 *   del compresor X?") y obtener la respuesta directamente del PDF.
 *
 * POR QUÉ GEMINI 2.5 FLASH Y NO OTRO MODELO:
 *   - Soporta contexto de hasta 1 millón de tokens, suficiente para PDFs
 *     técnicos extensos (manuales de 500+ páginas).
 *   - La API de Google admite PDFs directamente como tipo 'file' sin necesidad
 *     de extraer texto previamente (OCR incluido).
 *   - Costo-beneficio superior a Opus para tareas de extracción/resumen.
 *
 * POR QUÉ generateText Y NO generateObject:
 *   La respuesta es un análisis en lenguaje natural (texto libre), no
 *   datos estructurados. generateText es la herramienta correcta aquí.
 *
 */

'use server';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// Límites de tamaño definidos globalmente para todos los módulos de IA de GIMA.
// MAX_PDF_SIZE_MB protege contra PDFs escaneados de alta resolución que
// pueden pesar decenas de MB y agotar la cuota de la API.
import { MAX_PDF_SIZE_MB, bytesToMB } from '@/app/config/limits';

// Logger estructurado del proyecto. Registra errores con contexto (componente,
// acción) para facilitar el diagnóstico en producción.
import { logger } from '@/app/lib/logger';

// ============================================================
// SERVER ACTION: analyzePdf
// ============================================================

/**
 * Analiza un documento PDF usando Gemini Flash con contexto de 1M tokens.
 *
 * QUÉ HACE:
 *   Recibe un PDF como FormData, lo convierte a base64 y lo envía a Gemini
 *   junto con un prompt del usuario (o uno por defecto). Retorna el análisis
 *   como texto en lenguaje natural.
 *
 * CÓMO FUNCIONA (paso a paso):
 *   1. Extrae el archivo PDF y el prompt del FormData.
 *   2. Valida que el PDF no supere MAX_PDF_SIZE_MB.
 *   3. Convierte el PDF a base64 (requerido por la API de Gemini).
 *   4. Llama a `generateText` con el PDF adjunto como tipo 'file'.
 *      Gemini procesa el PDF nativamente (sin extracción previa de texto).
 *   5. Retorna { text, success } o { text: '', success: false, error }.
 *
 * DETALLES TÉCNICOS DE LA LLAMADA A GEMINI:
 *   - `type: 'file'` con `mediaType: 'application/pdf'` le dice a Gemini
 *     que el base64 representa un PDF completo, activando su procesador
 *     nativo de documentos (diferente al procesador de imágenes).
 *   - No se especifica temperatura porque el default de Gemini Flash es
 *     adecuado para síntesis y respuesta de preguntas (sin creatividad extra).
 *
 * @param formData - FormData con:
 *   - 'file'   (File, requerido): el documento PDF a analizar.
 *   - 'prompt' (string, opcional): pregunta o instrucción del usuario.
 *              Ejemplo: "¿Cuáles son los pasos de mantenimiento preventivo?"
 *              Default: "Analiza este documento PDF y resume sus puntos clave."
 * @returns Objeto con el texto de análisis y bandera de éxito.
 */
export async function analyzePdf(
  formData: FormData
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    // Paso 1: Extraer campos del FormData.
    // El cast a `File | null` es necesario porque TypeScript tipifica
    // FormData.get() como `FormDataEntryValue | null`.
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;

    if (!file) throw new Error('PDF vacío');

    // Paso 2: Validar tamaño del PDF.
    // PDFs escaneados (imágenes) pueden ser muy pesados. Rechazarlos temprano
    // evita timeouts en el servidor y gastos innecesarios de tokens.
    const sizeInBytes = file.size;
    const sizeInMB = bytesToMB(sizeInBytes);

    if (sizeInMB > MAX_PDF_SIZE_MB) {
      throw new Error(
        `PDF demasiado grande (${sizeInMB.toFixed(1)}MB). Máximo permitido: ${MAX_PDF_SIZE_MB}MB`
      );
    }

    // Paso 3: Convertir PDF a base64.
    // arrayBuffer() lee todo el contenido binario del archivo en memoria.
    // Buffer.toString('base64') lo codifica en la representación que Gemini espera.
    // NOTA: Para PDFs muy grandes, considerar streaming en versiones futuras.
    const buffer = await file.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

    // Paso 4: Llamar a Gemini Flash con el PDF adjunto.
    // El content array combina texto (prompt del usuario) + archivo (PDF en base64).
    // Gemini procesa ambos juntos para generar una respuesta contextualizada.
    const result = await generateText({
      model: google('gemini-2.5-flash'), // Flash: ventana de contexto 1M tokens, ideal para PDFs largos
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              // Si el usuario proporcionó una pregunta específica, se usa esa.
              // El prompt default es suficiente para resúmenes generales.
              text: prompt || 'Analiza este documento PDF y resume sus puntos clave.',
            },
            {
              type: 'file',
              data: base64Content,
              mediaType: 'application/pdf', // Activa el procesador de documentos de Gemini
            },
          ],
        },
      ],
    });

    return { text: result.text, success: true };
  } catch (error: unknown) {
    // El logger incluye contexto estructurado para filtrar errores por módulo
    // en herramientas como Datadog, Sentry o los logs de Vercel.
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
