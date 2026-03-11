/**
 * @file closeout-generation.ts
 * @module app/lib/prompts/closeout-generation
 *
 * ============================================================
 * PROMPTS — GENERACIÓN DE NOTAS DE CIERRE DE ÓRDENES DE TRABAJO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los prompts, templates e instrucciones por estilo para generar
 *   notas de cierre (closeout notes) profesionales para Órdenes de Trabajo
 *   completadas en GIMA, usando Gemini Flash (o el modelo configurado
 *   en AI_TASK_MODELS.WORK_ORDER_CLOSEOUT).
 *
 * DIFERENCIA CON activity-summary-generation.ts:
 *   - Resúmenes de actividad: orientados al trabajo técnico en sí
 *     (qué se hizo, cómo, con qué herramientas). Output: documento de referencia.
 *   - Notas de cierre: orientadas a la OT como entidad del sistema CMMS
 *     (materiales consumidos, tiempo por actividad, próximas acciones, costos).
 *     Output: formulario de cierre que se adjunta a la OT en el backend.
 *
 * CAMPOS ESPECÍFICOS DE CLOSEOUT (vs resúmenes):
 *   El output de este módulo incluye campos que no existen en los resúmenes:
 *   - `materialsUsed`: lista de repuestos y materiales consumidos (para inventario).
 *   - `timeBreakdown`: desglose de horas por actividad (para costos de mano de obra).
 *   - `nextActions`: acciones pendientes que deben generarse como nuevas OTs.
 *
 * ARQUITECTURA DEL PROMPT EN DOS PARTES:
 *   El servicio WorkOrderCloseoutAIService ensambla el prompt final con:
 *   1. CLOSEOUT_SYSTEM_PROMPT (invariante): rol, reglas y JSON schema del output.
 *   2. buildCloseoutPrompt() (variable): datos específicos de la OT (ID, actividades,
 *      materiales, tiempo, estilo seleccionado por el usuario).
 *
 * ESTRUCTURA DEL OUTPUT DEL LLM:
 *   ```json
 *   {
 *     "summary": "Se completó el mantenimiento preventivo semestral de la UMA-03...",
 *     "workPerformed": "Se procedió a la revisión y limpieza de filtros...",
 *     "findings": "Se detectó desgaste prematuro en el rodamiento del ventilador...",
 *     "recommendations": "Programar reemplazo del rodamiento en próxima ventana...",
 *     "materialsUsed": "2 filtros HEPA modelo FH-220, 1L aceite lubricante ISO 32",
 *     "timeBreakdown": "Preparación y lockout: 30min, limpieza filtros: 45min...",
 *     "nextActions": "Crear OT de reemplazo de rodamiento. Validar con proveedor..."
 *   }
 *   ```
 *
 * FLUJO DE USO EN WorkOrderCloseoutAIService:
 *   1. Llamada inicial: CLOSEOUT_SYSTEM_PROMPT + buildCloseoutPrompt(params)
 *   2. Si el JSON es inválido: segundo intento con CLOSEOUT_RETRY_PROMPT
 *   3. Si el segundo intento falla: AIServiceError (no recuperable)
 *
 * DÓNDE SE USA:
 *   - app/lib/services/work-order-closeout-ai-service.ts → generateCloseoutNotes()
 *   - app/components/features/ai-tools/work-order-closeout/ → WorkOrderCloseoutForm
 * ============================================================
 */

import type { CloseoutStyle } from '@/app/components/features/ai-tools/work-order-closeout/types';

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * System prompt base para generación de notas de cierre de OTs.
 *
 * QUÉ ESTABLECE:
 *   - Rol del modelo: supervisor de mantenimiento industrial con 15+ años de experiencia.
 *     El rol de "supervisor" (vs técnico) orienta al LLM hacia una perspectiva que
 *     incluye aspectos de gestión: costos, próximas acciones y recomendaciones
 *     estratégicas, no solo la descripción técnica del trabajo.
 *   - Siete campos de output bien definidos: esto garantiza que el JSON sea
 *     directamente mapeble al schema Zod del servicio sin transformaciones adicionales.
 *   - JSON estricto sin markdown: crítico para el parser del servicio.
 *
 * SIETE CAMPOS DEL OUTPUT Y SU PROPÓSITO:
 *   `summary`         → Resumen ejecutivo (para la vista de lista de OTs cerradas).
 *   `workPerformed`   → Descripción detallada (para el historial técnico del activo).
 *   `findings`        → Hallazgos (alimenta el análisis de fallas recurrentes en GIMA).
 *   `recommendations` → Recomendaciones (puede generar nuevas OTs preventivas).
 *   `materialsUsed`   → Materiales usados (actualiza el inventario y costos de la OT).
 *   `timeBreakdown`   → Desglose de tiempo (para cálculo de costo de mano de obra).
 *   `nextActions`     → Próximas acciones (para backlog de mantenimiento futuro).
 *
 * POR QUÉ `findings` Y `recommendations` SON CAMPOS SEPARADOS:
 *   En la práctica de CMMS, los hallazgos (observaciones objetivas) y las
 *   recomendaciones (acciones sugeridas subjetivas) se registran por separado
 *   para mantener la trazabilidad: los hallazgos son hechos inmutables del
 *   historial, las recomendaciones pueden variar según el criterio del supervisor.
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

// ============================================================
// INSTRUCCIONES POR ESTILO
// ============================================================

/**
 * Retorna instrucciones de redacción específicas para el estilo de nota de cierre.
 *
 * QUÉ HACE:
 *   Adapta el tono, estructura y nivel de formalidad de la nota de cierre
 *   según el contexto en que será usada.
 *
 * POR QUÉ TRES ESTILOS PARA NOTAS DE CIERRE:
 *   Los destinatarios de una nota de cierre de OT varían según el contexto:
 *
 *   FORMAL:    Para OTs de alta prioridad, activos críticos o auditorías.
 *              El supervisor o gerente revisará el documento directamente.
 *              Requiere párrafos completos, contexto y justificaciones.
 *              Ejemplo: cierre de OT en generador de emergencia hospitalario.
 *
 *   TÉCNICO:   Para OTs de mantenimiento regular donde el archivo va al historial
 *              técnico del activo en el CMMS. Los ingenieros lo consultarán
 *              en el futuro para reproducir procedimientos o identificar patrones.
 *              Ejemplo: cierre de OT de calibración anual de compresor industrial.
 *
 *   BREVE:     Para OTs de mantenimiento rutinario de baja complejidad donde
 *              el registro es obligatorio pero el tiempo del técnico es limitado.
 *              Ejemplo: cierre de OT de limpieza semanal de filtros de HVAC.
 *
 * NOTA SOBRE LA IMPORTACIÓN DE CloseoutStyle:
 *   El tipo `CloseoutStyle` viene del componente WorkOrderCloseoutForm y es
 *   un union de literales: 'formal' | 'technical' | 'brief'.
 *   Se importa desde el componente (no desde constants/ai.ts) porque es
 *   específico del feature de cierre de OT, no un concepto general de la app.
 *
 * @param style - Estilo de la nota de cierre seleccionado por el usuario en la UI.
 * @returns Bloque de instrucciones de redacción para incluir en buildCloseoutPrompt().
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
- Referencias a manuales, estándares o especificaciones cuando aplique
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

// ============================================================
// BUILDER DEL PROMPT DE USUARIO
// ============================================================

/**
 * Construye el prompt de usuario completo para la generación de notas de cierre.
 *
 * QUÉ HACE:
 *   Ensambla todos los datos de la OT en un prompt estructurado que el LLM
 *   puede procesar para generar las notas de cierre. Incluye:
 *   1. Datos identificativos de la OT (ID, título, descripción, tipo, prioridad).
 *   2. Datos operativos (actividades realizadas, materiales usados, tiempo total).
 *   3. Datos de contexto (problemas encontrados, si los hay).
 *   4. Instrucciones de estilo según CloseoutStyle.
 *   5. Instrucción sobre si incluir o no recomendaciones.
 *
 * SECCIONES CONDICIONALES:
 *   `materialsSection` e `issuesSection` solo se añaden al prompt si existen datos.
 *   Esto evita incluir secciones vacías (ej: "MATERIALES YA UTILIZADOS:\n\n") que
 *   confundirían al LLM y podrían hacer que invente materiales inexistentes.
 *
 * PARÁMETRO `includeRecommendations`:
 *   Algunas OTs (ej: correctivos cerrados sin hallazgos) no necesitan recomendaciones.
 *   El usuario lo controla desde la UI. La instrucción explícita previene que el LLM
 *   genere recomendaciones cuando no se solicitaron, ocupando tokens innecesariamente.
 *
 * FORMATEO DE `assetType`:
 *   `.replace('-', ' ').toUpperCase()` convierte 'panel-electrico' → 'PANEL ELECTRICO'.
 *   El formato uppercase en el prompt comunica al LLM que es un campo de datos
 *   (no texto narrativo) y mejora la legibilidad del prompt estructurado.
 *
 * @param params.workOrderId           - ID único de la OT en el sistema GIMA.
 * @param params.title                 - Título descriptivo de la OT.
 * @param params.description           - Descripción original del trabajo solicitado.
 * @param params.assetType             - Tipo de activo intervenido.
 * @param params.taskType              - Tipo de mantenimiento realizado.
 * @param params.priority              - Prioridad de la OT (baja/media/alta/urgente).
 * @param params.activities            - Array de actividades realizadas por el técnico.
 * @param params.materialsUsed         - Array de materiales y repuestos utilizados (opcional).
 * @param params.timeSpent             - Tiempo total invertido en horas.
 * @param params.issues                - Array de problemas encontrados durante el trabajo (opcional).
 * @param params.style                 - Estilo de redacción de la nota de cierre.
 * @param params.includeRecommendations - Si el LLM debe generar recomendaciones.
 * @returns Prompt de usuario completo listo para enviarse al LLM.
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

  // Sección de materiales: solo se añade si hay materiales registrados
  const materialsSection =
    materialsUsed && materialsUsed.length > 0
      ? `\nMATERIALES YA UTILIZADOS:\n${materialsUsed.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : '';

  // Sección de problemas: solo se añade si se registraron incidencias durante el trabajo
  const issuesSection =
    issues && issues.length > 0
      ? `\nPROBLEMAS ENCONTRADOS:\n${issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')}`
      : '';

  // Instrucción explícita sobre recomendaciones para evitar que el LLM las genere
  // cuando no son necesarias (ej: OT correctiva sin hallazgos adicionales)
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

// ============================================================
// PROMPT DE REINTENTO
// ============================================================

/**
 * Prompt de reintento cuando el LLM genera una respuesta con formato JSON inválido.
 *
 * CUÁNDO SE USA:
 *   WorkOrderCloseoutAIService parsea la respuesta con JSON.parse().
 *   Si el parse falla, envía este prompt en un segundo intento con la estructura
 *   exacta del output esperado, incluyendo todos los siete campos obligatorios.
 *
 * POR QUÉ SIETE CAMPOS CON DESCRIPCIÓN Y NO SOLO LAS KEYS:
 *   El LLM puede confundirse sobre el contenido esperado en cada campo si solo
 *   ve las keys. El texto descriptivo entre comillas actúa como valor de ejemplo
 *   (few-shot dentro del prompt de retry) que guía al modelo en la segunda oportunidad.
 *
 * CAMPOS `recommendations` Y `nextActions` CON ACLARACIÓN "(puede ser string vacío)":
 *   Algunos LLMs omiten estos campos cuando no tienen contenido para ellos,
 *   causando errores de validación Zod en el servicio. La aclaración explícita
 *   indica que se espera al menos una string vacía ("") si no hay recomendaciones.
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
