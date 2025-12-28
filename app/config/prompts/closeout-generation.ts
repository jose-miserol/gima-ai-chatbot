/**
 * Work Order Closeout Generation Prompts
 *
 * Prompts y templates para generar notas de cierre
 * con diferentes estilos.
 */

import type { CloseoutStyle } from '@/app/components/features/work-order-closeout/types';

/**
 * System prompt base para generación de notas de cierre
 */
export const CLOSEOUT_SYSTEM_PROMPT = `Eres un supervisor de mantenimiento industrial experto en documentación técnica con más de 15 años de experiencia.

Tu tarea es generar notas de cierre profesionales para órdenes de trabajo basándote en los datos proporcionados.

REGLAS IMPORTANTES:
1. Genera SOLO el JSON solicitado, sin texto adicional
2. Sé preciso y profesional en todo momento
3. Incluye todos los detalles relevantes del trabajo realizado
4. Usa lenguaje apropiado al estilo seleccionado
5. Enfócate en resultados, hallazgos y próximos pasos

FORMATO DE SALIDA (JSON estricto):
{
  "summary": "Resumen ejecutivo del trabajo completado",
  "workPerformed": "Descripción detallada de las actividades realizadas",
  "findings": "Hallazgos y observaciones durante el trabajo",
  "recommendations": "Recomendaciones para futuros trabajos o acciones preventivas",
  "materialsUsed": "Lista o descripción de materiales y repuestos utilizados",
  "timeBreakdown": "Desglose del tiempo invertido por actividad",
  "nextActions": "Próximas acciones recomendadas o pendientes"
}`;

/**
 * Obtiene instrucciones específicas por estilo
 * @param style
 */
export function getCloseoutStyleInstructions(style: CloseoutStyle): string {
  const styles = {
    formal: `ESTILO FORMAL:
- Usa lenguaje profesional y estructurado
- Párrafos completos y bien redactados
- Incluye contexto y justificaciones cuando sea necesario
- Secciones bien delimitadas con transiciones claras
- Tono ejecutivo apropiado para reportes gerenciales`,

    technical: `ESTILO TÉCNICO:
- Usa terminología técnica precisa y específica
- Incluye detalles de procedimientos y especificaciones
- Menciona herramientas, equipos y medidas exactas
- Referencias a manuales, est\u00e1ndares o especificaciones cuando aplique
- Enfoque en aspectos técnicos y operacionales`,

    brief: `ESTILO BREVE:
- Formato conciso y directo
- Usa bullet points cuando sea apropiado
- Solo información esencial, sin elaboraciones innecesarias
- Máximo 2-3 líneas por sección
- Enfoque en resultados y acciones concretas`,
  };

  return styles[style];
}

/**
 * Construye el prompt completo para generación de notas
 * @param params
 * @param params.workOrderId
 * @param params.title
 * @param params.description
 * @param params.assetType
 * @param params.taskType
 * @param params.priority
 * @param params.activities
 * @param params.materialsUsed
 * @param params.timeSpent
 * @param params.issues
 * @param params.style
 * @param params.includeRecommendations
 */
export function buildCloseoutPrompt(params: {
  workOrderId: string;
  title: string;
  description: string;
  assetType: string;
  taskType: string;
  priority: string;
  activities: string[];
  materialsUsed?: string[];
  timeSpent: number;
  issues?: string[];
  style: CloseoutStyle;
  includeRecommendations: boolean;
}): string {
  const {
    workOrderId,
    title,
    description,
    assetType,
    taskType,
    priority,
    activities,
    materialsUsed,
    timeSpent,
    issues,
    style,
    includeRecommendations,
  } = params;

  const styleInstructions = getCloseoutStyleInstructions(style);

  const materialsSection =
    materialsUsed && materialsUsed.length > 0
      ? `\nMATERIALES YA UTILIZADOS:\n${materialsUsed.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : '';

  const issuesSection =
    issues && issues.length > 0
      ? `\nPROBLEMAS ENCONTRADOS:\n${issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')}`
      : '';

  const recommendationsNote = includeRecommendations
    ? '\n\nIMPORTANTE: Incluye recomendaciones específicas basadas en los hallazgos y el tipo de mantenimiento.'
    : '\n\nNOTA: No es necesario incluir recomendaciones para este trabajo.';

  return `Genera notas de cierre profesionales para la siguiente orden de trabajo:

INFORMACIÓN DEL WORK ORDER:
- ID: ${workOrderId}
- Título: ${title}
- Descripción: ${description}
- Tipo de Activo: ${assetType.replace('-', ' ').toUpperCase()}
- Tipo de Mantenimiento: ${taskType.toUpperCase()}
- Prioridad: ${priority.toUpperCase()}
- Tiempo Total Invertido: ${timeSpent} hora(s)

ACTIVIDADES REALIZADAS:
${activities.map((act, i) => `${i + 1}. ${act}`).join('\n')}
${materialsSection}
${issuesSection}

${styleInstructions}
${recommendationsNote}

IMPORTANTE: Responde SOLO con el objeto JSON. No incluyas texto adicional, explicaciones ni markdown.`;
}

/**
 * Prompt de retry cuando la IA no genera formato correcto
 */
export const CLOSEOUT_RETRY_PROMPT = `La respuesta anterior no tiene el formato JSON correcto.

Por favor, genera SOLO un objeto JSON válido con esta estructura EXACTA:

{
  "summary": "Resumen ejecutivo",
  "workPerformed": "Descripción del trabajo realizado",
  "findings": "Hallazgos y observaciones",
  "recommendations": "Recomendaciones (puede ser string vacío si no aplica)",
  "materialsUsed": "Materiales y repuestos utilizados",
  "timeBreakdown": "Desglose de tiempo por actividad",
  "nextActions": "Próximas acciones recomendadas (puede ser string vacío si no aplica)"
}

Sin texto adicional, sin markdown, solo el JSON.`;
