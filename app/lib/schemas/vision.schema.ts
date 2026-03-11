/**
 * @file vision.schema.ts
 * @module app/lib/schemas/vision.schema
 *
 * ============================================================
 * SCHEMA ZOD — ANÁLISIS DE IMÁGENES DE PIEZAS INDUSTRIALES
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define el schema Zod `partAnalysisSchema` que valida el objeto JSON
 *   retornado por Gemini al analizar una fotografía de una pieza industrial.
 *   Actúa como contrato entre la Server Action `analyzePartImage` (vision.ts)
 *   y los componentes de UI del módulo de inventario.
 *
 * CONTEXTO EN GIMA:
 *   Los operadores de bodega toman una foto de una pieza para identificarla
 *   rápidamente y pre-cargar el formulario de alta de inventario. Este schema
 *   define exactamente qué campos debe extraer Gemini de la imagen, con
 *   `.describe()` en cada campo que actúa como instrucción adicional para el LLM.
 *
 * POR QUÉ LOS `.describe()` SON CRÍTICOS:
 *   `generateObject` (vision.ts) convierte este schema a JSON Schema y lo
 *   envía a Gemini como parte del prompt. Los `.describe()` son literalmente
 *   las instrucciones que el modelo recibe para cada campo. Una descripción
 *   clara reduce las alucinaciones y mejora la precisión de la identificación.
 *
 * RELACIÓN CON ENTIDADES DEL BACKEND:
 *   Los campos del schema están alineados con las entidades `Articulo` y
 *   `Repuesto` del backend Laravel (backend-response.schema.ts) para que
 *   el formulario de inventario pueda pre-cargarse con mapeo directo.
 *
 * NOTA SOBRE `nivel_confianza`:
 *   El modelo reporta su propio nivel de confianza. 'baja' es una señal
 *   para que el operador revise manualmente antes de guardar el registro,
 *   evitando entradas incorrectas en el inventario.
 *
 */

import { z } from 'zod';

/**
 * Schema de validación para el resultado del análisis de imágenes de piezas.
 *
 * CUÁNDO SE USA:
 *   En `analyzePartImage` (vision.ts) como `schema` de `generateObject`.
 *   Gemini recibe este schema como JSON Schema y retorna un objeto que lo cumple.
 *   Si el objeto retornado no cumple el schema, `generateObject` lanza un error.
 *
 * CAMPOS OPCIONALES:
 *   `codigo`, `marca` y `modelo` son opcionales porque no siempre son visibles
 *   en la fotografía (placa de datos girada, etiqueta borrada, ángulo inadecuado).
 *   El operador puede completar estos campos manualmente si es necesario.
 */
export const partAnalysisSchema = z.object({
  /** Clasificación general: 'mobiliario' (muebles, sillas) o 'equipo' (maquinaria técnica). */
  tipo_articulo: z.enum(['mobiliario', 'equipo']).describe('Clasificación general del artículo'),

  /** Código alfanumérico visible en la pieza (etiqueta, grabado, placa de datos). */
  codigo: z.string().optional().describe('Código identificado visible en la pieza'),

  /** Descripción completa para que un técnico entienda qué es la pieza sin verla. */
  descripcion: z.string().describe('Descripción detallada de la pieza o equipo'),

  /** Marca del fabricante si es legible en la fotografía. */
  marca: z.string().optional().describe('Marca del fabricante si es visible'),

  /** Modelo específico del equipo si la placa de datos es visible. */
  modelo: z.string().optional().describe('Modelo del equipo si es visible'),

  /** Cuántas unidades de esta pieza aparecen en la foto (puede haber varias en un lote). */
  cantidad_detectada: z.number().describe('Cantidad de piezas de este tipo detectadas en la foto'),

  /**
   * Estado visual actual de la pieza:
   * - 'nuevo'               → Sin uso aparente, embalaje o aspecto de fábrica.
   * - 'usado'               → Desgaste normal de operación.
   * - 'dañado'              → Rotura, corrosión, deformación visible.
   * - 'requiere_inspeccion' → Estado dudoso, no clasificable visualmente.
   */
  estado_fisico: z
    .enum(['nuevo', 'usado', 'dañado', 'requiere_inspeccion'])
    .describe('Condición visual de la pieza'),

  /**
   * Acción sugerida por el modelo para el manejo de la pieza.
   * Ej: "Limpiar contactos antes de almacenar", "Almacenar en lugar seco".
   */
  recomendacion: z
    .string()
    .describe('Recomendación breve sobre el manejo o mantenimiento de la pieza'),

  /**
   * Nivel de confianza del modelo en su propia identificación.
   * 'baja' indica que el operador debe revisar manualmente los datos antes de guardar.
   */
  nivel_confianza: z
    .enum(['alta', 'media', 'baja'])
    .describe('Confianza de la IA sobre su identificación'),
});

/** Tipo TypeScript inferido del schema. Usado como tipo de retorno en vision.ts. */
export type PartAnalysisResult = z.infer<typeof partAnalysisSchema>;
