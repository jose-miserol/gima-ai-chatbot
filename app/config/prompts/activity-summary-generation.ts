/**
 * Activity Summary Generation Prompts
 *
 * Prompts y templates para generar resúmenes de actividades
 * con diferentes estilos y niveles de detalle.
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

/**
 * System prompt base para generación de resúmenes
 */
export const SUMMARY_SYSTEM_PROMPT = `Eres un experto redactor técnico especializado en documentación de mantenimiento industrial con más de 20 años de experiencia.

Tu tarea es generar resúmenes profesionales de actividades de mantenimiento basándote en notas y descripciones proporcionadas.

REGLAS IMPORTANTES:
1. Genera SOLO el JSON solicitado, sin texto adicional
2. El resumen ejecutivo debe ser conciso pero informativo (1-2 párrafos)
3. Las secciones deben estar bien organizadas y en orden lógico
4. Usa lenguaje profesional pero claro
5. Prioriza la información más relevante según el nivel de detalle
6. Mantén un tono apropiado al estilo solicitado

FORMATO DE SALIDA (JSON estricto):
{
  "title": "Título descriptivo del resumen",
  "executive": "Resumen ejecutivo de 1-2 párrafos",
  "sections": [
    {
      "title": "Título de sección",
      "content": "Contenido detallado de la sección",
      "order": 0
    }
  ]
}`;

/**
 * Obtiene instrucciones específicas por estilo
 *
 * @param style - Estilo del resumen
 * @returns Instrucciones específicas
 */
export function getStyleSpecificInstructions(style: 'ejecutivo' | 'tecnico' | 'narrativo'): string {
  const styles = {
    ejecutivo: `ESTILO EJECUTIVO:
- Enfócate en resultados y métricas clave
- Usa lenguaje conciso y directo
- Destaca impacto en operaciones
- Incluye recomendaciones si aplica
- Secciones típicas: Resumen, Hallazgos Clave, Impacto, Próximos Pasos`,

    tecnico: `ESTILO TÉCNICO:
- Incluye detalles técnicos específicos
- Menciona herramientas y procedimientos utilizados
- Documenta parámetros y mediciones
- Usa terminología técnica apropiada
- Secciones típicas: Procedimiento, Observaciones Técnicas, Mediciones, Conclusiones`,

    narrativo: `ESTILO NARRATIVO:
- Describe el proceso cronológicamente
- Incluye contexto de las actividades
- Usa lenguaje descriptivo pero profesional
- Explica razonamientos detrás de decisiones
- Secciones típicas: Contexto, Desarrollo de Actividades, Resultados, Reflexiones`,
  };

  return styles[style];
}

/**
 * Obtiene instrucciones específicas por nivel de detalle
 *
 * @param detailLevel - Nivel de detalle
 * @returns Instrucciones específicas
 */
export function getDetailLevelInstructions(detailLevel: 'alto' | 'medio' | 'bajo'): string {
  const levels = {
    alto: `NIVEL DE DETALLE ALTO:
- Incluye todos los detalles relevantes
- Genera 4-6 secciones detalladas
- Resumen ejecutivo de 2 párrafos
- Cada sección debe ser exhaustiva`,

    medio: `NIVEL DE DETALLE MEDIO:
- Balance entre detalle y concisión
- Genera 3-4 secciones
- Resumen ejecutivo de 1-2 párrafos
- Enfoca en puntos más importantes`,

    bajo: `NIVEL DE DETALLE BAJO:
- Solo información esencial
- Genera 2-3 secciones
- Resumen ejecutivo de 1 párrafo
- Máximo 1 párrafo por sección`,
  };

  return levels[detailLevel];
}

/**
 * Construye el prompt completo para generación de resumen
 *
 * @param params - Parámetros de generación
 * @returns Prompt completo
 */
export function buildSummaryPrompt(params: {
  assetType: AssetType;
  taskType: TaskType;
  activities: string;
  style: 'ejecutivo' | 'tecnico' | 'narrativo';
  detailLevel: 'alto' | 'medio' | 'bajo';
  context?: string;
}): string {
  const { assetType, taskType, activities, style, detailLevel, context } = params;

  const styleInstructions = getStyleSpecificInstructions(style);
  const detailInstructions = getDetailLevelInstructions(detailLevel);

  return `Genera un resumen profesional de mantenimiento con las siguientes especificaciones:

INFORMACIÓN DEL ACTIVO:
- Tipo de activo: ${assetType.replace('-', ' ').toUpperCase()}
- Tipo de mantenimiento: ${taskType.toUpperCase()}
${context ? `- Contexto adicional: ${context}` : ''}

${styleInstructions}

${detailInstructions}

ACTIVIDADES REALIZADAS:
"""
${activities}
"""

IMPORTANTE: Responde SOLO con el objeto JSON. No incluyas texto adicional, explicaciones ni markdown.`;
}

/**
 * Prompt de retry cuando la IA no genera formato correcto
 */
export const SUMMARY_RETRY_PROMPT = `La respuesta anterior no tiene el formato JSON correcto.

Por favor, genera SOLO un objeto JSON válido con esta estructura EXACTA:

{
  "title": "Título del resumen",
  "executive": "Resumen ejecutivo en 1-2 párrafos",
  "sections": [
    {
      "title": "Título de sección",
      "content": "Contenido de la sección",
      "order": 0
    }
  ]
}

Sin texto adicional, sin markdown, solo el JSON.`;
