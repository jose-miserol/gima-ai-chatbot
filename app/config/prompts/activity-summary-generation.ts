/**
 * @file activity-summary-generation.ts
 * @module app/lib/prompts/activity-summary-generation
 *
 * ============================================================
 * PROMPTS — GENERACIÓN DE RESÚMENES DE ACTIVIDADES CON IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los prompts, templates e instrucciones de estilo/detalle
 *   que usa ActivitySummaryAIService para generar resúmenes profesionales
 *   de actividades de mantenimiento mediante Llama 3.3 70B (vía GROQ).
 *
 * RELACIÓN CON LA HERRAMIENTA DE CHAT:
 *   La herramienta `generar_resumen_actividad` en chat-tools.ts invoca
 *   ActivitySummaryAIService con parámetros de `style` y `detailLevel`.
 *   Este módulo traduce esos parámetros a instrucciones concretas para el LLM.
 *
 * ARQUITECTURA DEL PROMPT EN TRES CAPAS:
 *   ActivitySummaryAIService construye el prompt combinando:
 *   1. SUMMARY_SYSTEM_PROMPT (invariante): rol, reglas de formato y schema JSON.
 *   2. getStyleSpecificInstructions(style): cómo redactar según el estilo.
 *   3. getDetailLevelInstructions(detailLevel): cuánto contenido generar.
 *   Estas tres capas se ensamblan en buildSummaryPrompt().
 *
 * ESTILOS DISPONIBLES:
 *   - ejecutivo: orientado a gerencia, métricas y decisiones
 *   - tecnico:   orientado a ingeniería, procedimientos y especificaciones
 *   - narrativo: orientado a cronología, contexto y explicaciones
 *
 * NIVELES DE DETALLE:
 *   - alto:  4-6 secciones, resumen de 2 párrafos (para reportes completos)
 *   - medio: 3-4 secciones, resumen de 1-2 párrafos (uso general)
 *   - bajo:  2-3 secciones, resumen de 1 párrafo (informes rápidos)
 *
 * ESTRUCTURA DEL OUTPUT DEL LLM:
 *   ```json
 *   {
 *     "title": "Mantenimiento Preventivo Semestral — Unidad HVAC Torre B",
 *     "executive": "Se realizó el mantenimiento preventivo programado...",
 *     "sections": [
 *       { "title": "Procedimiento", "content": "...", "order": 0 },
 *       { "title": "Hallazgos", "content": "...", "order": 1 }
 *     ]
 *   }
 *   ```
 *
 * DÓNDE SE USA:
 *   - app/lib/services/activity-summary-ai-service.ts → generateSummary()
 *   - La herramienta `generar_resumen_actividad` en chat-tools.ts consume el servicio
 * ============================================================
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * System prompt base para generación de resúmenes de actividades.
 *
 * QUÉ ESTABLECE:
 *   - Rol del modelo: redactor técnico especializado en documentación de mantenimiento.
 *     El rol de "redactor técnico" (vs solo "experto en mantenimiento") orienta al LLM
 *     hacia la producción de texto bien estructurado, no solo de datos técnicos.
 *   - Priorización de información: el LLM debe seleccionar la información más relevante
 *     según el nivel de detalle solicitado, no incluir todo indiscriminadamente.
 *   - JSON estricto: sin markdown ni texto adicional, crítico para el parser del servicio.
 *
 * CAMPO `sections[].order`:
 *   Número entero que determina el orden de renderizado de las secciones en la UI.
 *   El LLM debe asignarlo secuencialmente (0, 1, 2...). El componente SummaryCard
 *   ordena las secciones por este campo antes de renderizar, permitiendo que
 *   el servicio reordene secciones si es necesario sin tocar el componente.
 *
 * CAMPO `executive`:
 *   Resumen en 1-2 párrafos que aparece destacado al inicio del componente.
 *   Orientado a lectores que no necesitan el detalle completo (gerencia, clientes).
 *   El número de párrafos lo controla getDetailLevelInstructions().
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

// ============================================================
// INSTRUCCIONES POR ESTILO
// ============================================================

/**
 * Retorna instrucciones específicas de redacción según el estilo solicitado.
 *
 * QUÉ HACE:
 *   Proporciona al LLM directrices concretas sobre el tono, estructura y enfoque
 *   del resumen para cada uno de los tres estilos disponibles.
 *   Estas instrucciones se insertan en el prompt de usuario (buildSummaryPrompt)
 *   para complementar el rol genérico del system prompt.
 *
 * POR QUÉ TRES ESTILOS (y no solo uno "profesional"):
 *   Los resúmenes de GIMA tienen tres audiencias distintas con necesidades diferentes:
 *
 *   EJECUTIVO:  Para gerentes y supervisores que necesitan tomar decisiones rápidas.
 *               Énfasis en métricas (tiempo, costo), impacto operacional y próximos pasos.
 *               Ejemplo de uso: reporte semanal para el director de operaciones.
 *
 *   TÉCNICO:    Para ingenieros y técnicos que necesitan reproducir o revisar el trabajo.
 *               Énfasis en procedimientos, herramientas, mediciones y estándares.
 *               Ejemplo de uso: documentación en el sistema CMMS de la UNEG.
 *
 *   NARRATIVO:  Para comunicaciones a usuarios afectados o auditorías.
 *               Énfasis en cronología, contexto y justificaciones de decisiones.
 *               Ejemplo de uso: informe a la facultad sobre la intervención en HVAC.
 *
 * SECCIONES SUGERIDAS:
 *   Cada estilo incluye secciones típicas que guían al LLM. Son sugerencias, no
 *   obligaciones — el LLM puede adaptar según el contenido de las actividades.
 *
 * @param style - Estilo de redacción deseado.
 * @returns Bloque de instrucciones para incluir en el prompt de usuario.
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

// ============================================================
// INSTRUCCIONES POR NIVEL DE DETALLE
// ============================================================

/**
 * Retorna instrucciones específicas de extensión según el nivel de detalle.
 *
 * QUÉ HACE:
 *   Controla la "cantidad" de contenido que el LLM debe generar: número de
 *   secciones, longitud del resumen ejecutivo y profundidad de cada sección.
 *   Trabaja en combinación con getStyleSpecificInstructions() que controla
 *   el "tipo" de contenido.
 *
 * POR QUÉ SEPARAR ESTILO DE NIVEL DE DETALLE:
 *   Son dimensiones ortogonales del output:
 *   - Un resumen ejecutivo ALTO genera mucho contenido orientado a decisiones.
 *   - Un resumen técnico BAJO genera poco contenido pero técnico.
 *   - Un resumen narrativo MEDIO genera un texto descriptivo de extensión media.
 *   Si se mezclaran, necesitaríamos 9 combinaciones de instrucciones en lugar de 3+3.
 *
 * RANGOS DE SECCIONES:
 *   - alto:  4-6 secciones (informes exhaustivos, proyectos mayores)
 *   - medio: 3-4 secciones (mantenimientos regulares, uso más común)
 *   - bajo:  2-3 secciones (intervenciones rápidas, notas de turno)
 *
 * @param detailLevel - Nivel de extensión del resumen.
 * @returns Bloque de instrucciones para incluir en el prompt de usuario.
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

// ============================================================
// BUILDER DEL PROMPT DE USUARIO
// ============================================================

/**
 * Construye el prompt de usuario completo para generación de resúmenes.
 *
 * QUÉ HACE:
 *   Ensambla las tres capas del prompt de usuario:
 *   1. Contexto del activo y tarea (tipo de equipo, tipo de mantenimiento).
 *   2. Instrucciones de estilo (cómo redactar).
 *   3. Instrucciones de nivel de detalle (cuánto generar).
 *   4. Las actividades crudas del técnico entre triple comillas ("""...""") para
 *      que el LLM las interprete como "datos a procesar" y no como instrucciones.
 *
 * POR QUÉ TRIPLE COMILLAS PARA `activities`:
 *   Las actividades son texto libre del técnico que puede contener caracteres
 *   especiales o incluso instrucciones en lenguaje natural que el LLM podría
 *   confundir con parte del prompt. Las triple comillas (convención de LLMs)
 *   delimitan claramente el "dato a procesar" del "prompt de instrucciones",
 *   reduciendo el riesgo de prompt injection accidental.
 *
 * CAMPO `context` OPCIONAL:
 *   Información adicional sobre el contexto de la intervención (ej: "Equipo crítico
 *   de producción, máximo 4 horas de downtime permitido"). Se omite del prompt
 *   si no se proporciona para evitar añadir ruido innecesario al contexto del LLM.
 *
 * @param params.assetType   - Tipo de activo del catálogo GIMA.
 * @param params.taskType    - Tipo de mantenimiento realizado.
 * @param params.activities  - Texto libre del técnico describiendo lo que hizo.
 * @param params.style       - Estilo de redacción deseado.
 * @param params.detailLevel - Nivel de extensión del resumen.
 * @param params.context     - Contexto adicional opcional (ej: restricciones operativas).
 * @returns Prompt de usuario completo listo para enviarse al LLM.
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

// ============================================================
// PROMPT DE REINTENTO
// ============================================================

/**
 * Prompt de reintento cuando el LLM genera una respuesta con formato JSON inválido.
 *
 * CUÁNDO SE USA:
 *   ActivitySummaryAIService parsea la respuesta del LLM con JSON.parse().
 *   Si el parse falla, el servicio envía este prompt como segundo intento,
 *   haciendo énfasis explícito en el formato exacto requerido.
 *
 * POR QUÉ EL CAMPO `order` NECESITA ÉNFASIS ESPECIAL:
 *   Los LLMs frecuentemente omiten el campo `order` en las secciones o lo envían
 *   como string en lugar de número entero, causando errores de validación Zod
 *   en ActivitySummaryAIService. Este prompt recuerda la estructura exacta
 *   del array `sections` con un ejemplo completo del objeto.
 *
 * RELACIÓN CON CHECKLIST_RETRY_PROMPT:
 *   Mismo patrón pero adaptado a la estructura de resúmenes.
 *   Ambos siguen la convención del proyecto: prompt de reintento específico
 *   al tipo de output en lugar de un retry genérico.
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
