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
