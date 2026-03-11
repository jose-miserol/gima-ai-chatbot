/**
 * @file data-transformation.schema.ts
 * @module app/lib/schemas/data-transformation.schema
 *
 * ============================================================
 * SCHEMAS ZOD — TRANSFORMACIÓN DE DATOS CON IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod para la feature de transformación de datos
 *   asistida por IA de GIMA. El usuario proporciona datos en cualquier
 *   formato (JSON, CSV, texto) y una instrucción en lenguaje natural,
 *   y la IA retorna los datos transformados junto con estadísticas del
 *   cambio realizado.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos y administradores a veces necesitan limpiar, reformatear
 *   o enriquecer datos antes de importarlos al sistema (ej. convertir un
 *   CSV de inventario con columnas en inglés a la estructura del backend,
 *   o filtrar registros de mantenimiento por criterios específicos).
 *   Esta feature permite hacerlo sin necesidad de scripts ad-hoc.
 *
 * SCHEMAS DEFINIDOS:
 *   - `transformationResponseSchema` → Formato que el LLM debe retornar.
 *   - `transformationActionSchema`   → Input del usuario para la Server Action.
 *
 * POR QUÉ `data: z.unknown()` EN LA RESPUESTA:
 *   Los datos transformados pueden ser cualquier estructura válida de JSON
 *   (array de objetos, objeto anidado, etc.) que depende de la instrucción
 *   del usuario. Usar `z.unknown()` permite cualquier estructura mientras
 *   se validan los campos de control (`success`, `summary`, `stats`)
 *   que la UI siempre necesita independientemente de los datos.
 *
 */

import { z } from 'zod';

// ============================================================
// SCHEMAS
// ============================================================

/**
 * Schema para validar la respuesta estructurada del LLM.
 *
 * CUÁNDO SE USA:
 *   En la Server Action de transformación, después de recibir la respuesta
 *   del modelo. Garantiza que el JSON retornado tiene los campos de control
 *   necesarios para que la UI pueda renderizar el resultado correctamente
 *   e informar al usuario de qué cambió.
 *
 * @property success   - Si la transformación se realizó según la instrucción.
 *                       Puede ser false si la instrucción era ambigua o imposible.
 * @property data      - Los datos transformados (array u objeto). Tipo unknown
 *                       porque la estructura depende de la instrucción del usuario.
 * @property summary   - Descripción breve de los cambios realizados en lenguaje natural.
 * @property stats     - Estadísticas de la transformación para mostrar al usuario.
 * @property stats.additions - Elementos o campos añadidos durante la transformación.
 * @property stats.deletions - Elementos o campos eliminados durante la transformación.
 */
export const transformationResponseSchema = z.object({
  success: z.boolean().describe('Indica si la transformación fue exitosa según la instrucción'),
  data: z.unknown().describe('Los datos transformados resultantes (array u objeto)'),
  summary: z.string().describe('Breve descripción de los cambios realizados'),
  stats: z
    .object({
      additions: z.number().describe('Conteo estimado de elementos o campos agregados'),
      deletions: z.number().describe('Conteo estimado de elementos o campos eliminados'),
    })
    .describe('Estadísticas de la transformación'),
});

/**
 * Schema para validar el input de la Server Action de transformación.
 *
 * CUÁNDO SE USA:
 *   Al inicio de la Server Action antes de llamar al LLM. Rechaza
 *   payloads demasiado grandes (> 1MB) y instrucciones vacías o excesivamente
 *   largas antes de consumir tokens de la API.
 *
 * @property sourceData   - Datos de origen en formato string (JSON serializado,
 *                          CSV como texto, o texto libre). Máx 1MB.
 * @property instruction  - Instrucción de transformación en lenguaje natural.
 *                          Ej: "Convierte las fechas al formato DD/MM/YYYY"
 *                          Mín 3 chars, máx 1000 chars.
 * @property context      - Contexto adicional opcional para guiar la transformación.
 *                          Ej: "Estos datos son de un sistema legacy con encoding Latin-1"
 * @property format       - Formato de los datos de origen. 'auto' intenta detectarlo.
 *                          Valores: 'json' | 'csv' | 'text' | 'auto'. Default 'auto'.
 */
export const transformationActionSchema = z.object({
  sourceData: z
    .string()
    .min(1, 'Los datos de origen son requeridos')
    .max(1000000, 'Datos demasiado grandes'),
  instruction: z
    .string()
    .min(3, 'La instrucción es muy corta')
    .max(1000, 'Instrucción demasiado larga'),
  context: z.string().optional(),
  format: z.enum(['json', 'csv', 'text', 'auto']).optional().default('auto'),
});

// ============================================================
// TIPOS INFERIDOS
// ============================================================

/** Respuesta estructurada del LLM tras la transformación. */
export type TransformationResponse = z.infer<typeof transformationResponseSchema>;

/** Input validado de la Server Action de transformación. */
export type TransformationAction = z.infer<typeof transformationActionSchema>;
