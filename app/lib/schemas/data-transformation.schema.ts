import { z } from 'zod';

/**
 * Schema para validar la respuesta estructurada de la IA
 * Asegura que el modelo devuelva un JSON con el formato correcto.
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
 * Type inferido de la respuesta de transformación
 */
export type TransformationResponse = z.infer<typeof transformationResponseSchema>;

/**
 * Schema para validar la petición de transformación (Server Action input)
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
