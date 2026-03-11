/**
 * @file checklist-generation.ts
 * @module app/lib/prompts/checklist-generation
 *
 * ============================================================
 * PROMPTS — GENERACIÓN DE CHECKLISTS DE MANTENIMIENTO CON IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los prompts, templates y guidance específico por tipo de activo
 *   que usa ChecklistAIService para generar checklists de mantenimiento
 *   personalizados mediante Llama 3.3 70B (vía GROQ).
 *
 * POR QUÉ PROMPTS EN UN MÓDULO SEPARADO:
 *   Los prompts son la "configuración" del comportamiento de la IA, análogos
 *   a un schema de base de datos. Separarlos del servicio permite:
 *   - Iterar sobre el texto sin tocar la lógica del servicio.
 *   - Testear las instrucciones de forma aislada.
 *   - Reutilizar partes del prompt (ej: CHECKLIST_RETRY_PROMPT) en múltiples
 *     puntos del flujo de reintento.
 *
 * ARQUITECTURA DEL PROMPT EN DOS PARTES:
 *   ChecklistAIService construye el prompt final combinando:
 *   1. CHECKLIST_SYSTEM_PROMPT (invariante): rol del modelo, reglas obligatorias
 *      y el JSON Schema de la respuesta esperada.
 *   2. buildChecklistPrompt() (variable): el tipo de activo y tarea específicos,
 *      instrucciones adicionales del usuario y guidance específico del activo.
 *
 * ESTRUCTURA DEL OUTPUT DEL LLM:
 *   El modelo debe retornar JSON estricto (sin markdown, sin texto adicional):
 *   ```json
 *   {
 *     "title": "Checklist de Mantenimiento Preventivo — Unidad HVAC",
 *     "description": "Verificación semestral de sistema de aire acondicionado",
 *     "items": [
 *       {
 *         "description": "Verificar alimentación eléctrica antes de intervenir",
 *         "category": "seguridad",
 *         "required": true,
 *         "notes": "Lockout/Tagout obligatorio según OSHA 1910.147"
 *       }
 *     ]
 *   }
 *   ```
 *
 * FLUJO DE USO EN ChecklistAIService:
 *   1. Llamada inicial: CHECKLIST_SYSTEM_PROMPT + buildChecklistPrompt()
 *   2. Si el JSON es inválido: segundo intento con CHECKLIST_RETRY_PROMPT
 *   3. Si el segundo intento falla: AIServiceError (no recuperable)
 *
 * DÓNDE SE USA:
 *   - app/lib/services/checklist-ai-service.ts → generateChecklist()
 *   - La herramienta `generar_checklist` en chat-tools.ts consume el servicio
 * ============================================================
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

// ============================================================
// SYSTEM PROMPT
// ============================================================

/**
 * System prompt base para generación de checklists de mantenimiento.
 *
 * QUÉ ESTABLECE:
 *   - Rol del modelo: experto en mantenimiento industrial con 20+ años de experiencia.
 *     El rol específico mejora la calidad de las respuestas: los LLMs generan contenido
 *     más técnico y preciso cuando tienen un contexto de expertise claro.
 *   - Reglas de formato: JSON estricto sin markdown (crítico para el parser del servicio).
 *   - Ordenamiento lógico: preparación → ejecución → verificación → cierre.
 *     Este orden es el estándar industrial para procedimientos de mantenimiento (CMMS).
 *   - Priorización de seguridad: los items de seguridad siempre primero.
 *     Cumple con estándares OSHA/NFPA donde los LTOs (Lock Tag Out) preceden a cualquier
 *     intervención en equipos eléctricos o bajo presión.
 *
 * CATÁLOGO DE CATEGORÍAS:
 *   Definidas aquí (no solo en el tipo TypeScript) para que el LLM tenga la lista
 *   completa disponible en contexto y no invente categorías propias.
 *   Cada categoría mapea a un ícono y color en el componente ChecklistCard de la UI.
 *
 * POR QUÉ `required: true/false` EN VEZ DE UN NIVEL DE PRIORIDAD:
 *   El campo `required` es un booleano binario que el UI usa para marcar items
 *   con un indicador visual de obligatoriedad. Los ítems de seguridad crítica
 *   (ej: Lockout/Tagout) siempre son `required: true`.
 *   Un campo de prioridad multinivel agregaría complejidad sin valor real para el técnico.
 */
export const CHECKLIST_SYSTEM_PROMPT = `Eres un experto en mantenimiento industrial con más de 20 años de experiencia.
Tu tarea es generar checklists de mantenimiento detallados, prácticos y seguros.

REGLAS OBLIGATORIAS:
1. Los checklists deben ser específicos para el tipo de equipo y tarea solicitada
2. Incluir SIEMPRE verificaciones de seguridad primero
3. Usar lenguaje claro y técnico apropiado
4. Ordenar items lógicamente (preparación → ejecución → verificación → cierre)
5. Marcar como "required: true" los pasos críticos de seguridad
6. Incluir notas útiles cuando sea necesario

CATEGORÍAS VÁLIDAS:
- seguridad: Verificaciones de seguridad obligatorias
- operacion: Pasos operativos del mantenimiento
- inspeccion-visual: Inspecciones visuales
- mediciones: Mediciones técnicas (temperatura, presión, etc.)
- limpieza: Tareas de limpieza
- lubricacion: Lubricación y engrase
- ajustes: Ajustes mecánicos o eléctricos
- documentacion: Registro y documentación

FORMATO DE RESPUESTA (JSON):
{
  "title": "Título descriptivo del checklist",
  "description": "Descripción breve del checklist (1-2 líneas)",
  "items": [
    {
      "description": "Descripción clara del paso",
      "category": "una de las categorías válidas",
      "required": true/false,
      "notes": "OPCIONAL: Notas adicionales si son necesarias"
    }
  ]
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.`;

// ============================================================
// BUILDER DEL PROMPT DE USUARIO
// ============================================================

/**
 * Construye el prompt de usuario para generar un checklist específico.
 *
 * QUÉ HACE:
 *   Combina el tipo de activo, el tipo de tarea, las instrucciones opcionales
 *   del usuario y el guidance técnico específico del activo en un único prompt
 *   de usuario que se pasa junto con CHECKLIST_SYSTEM_PROMPT.
 *
 * ESTRUCTURA DEL PROMPT GENERADO:
 *   1. Enunciado principal: "Genera un checklist de {taskType} para: {assetName}"
 *   2. Restricción de cantidad: entre 8 y 15 items (balance entre exhaustividad y usabilidad).
 *   3. Instrucciones adicionales del usuario (si las hay).
 *   4. Consideraciones específicas del activo (si getAssetSpecificGuidance retorna algo).
 *
 * POR QUÉ 8-15 ITEMS:
 *   - Menos de 8: el checklist sería incompleto para la mayoría de equipos industriales.
 *   - Más de 15: satura el contexto del LLM y produce checklists con items redundantes
 *     o demasiado granulares que dificultan el uso en campo por el técnico.
 *
 * @param assetType          - Tipo de activo del catálogo GIMA (ej: 'unidad-hvac', 'caldera').
 * @param taskType           - Tipo de mantenimiento ('preventivo', 'correctivo', 'predictivo').
 * @param customInstructions - Instrucciones adicionales del usuario (ej: "incluir verificación de garantía").
 * @returns Prompt de usuario completo listo para enviarse al LLM junto con CHECKLIST_SYSTEM_PROMPT.
 */
export function buildChecklistPrompt(
  assetType: AssetType,
  taskType: TaskType,
  customInstructions?: string
): string {
  // Formatear el nombre del activo para el LLM: 'unidad-hvac' → 'unidad hvac' (más natural)
  const assetName = assetType.replace('-', ' ');

  let prompt = `Genera un checklist de mantenimiento ${taskType} para: ${assetName}

El checklist debe contener entre 8 y 15 items.`;

  // Instrucciones del usuario: se añaden ANTES del guidance del activo para que
  // el LLM las pondere con mayor peso (posición más cercana al inicio del prompt)
  if (customInstructions) {
    prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${customInstructions}`;
  }

  // Guidance específico del activo: recordatorios técnicos clave para ese tipo de equipo
  const assetGuidance = getAssetSpecificGuidance(assetType, taskType);
  if (assetGuidance) {
    prompt += `\n\nCONSIDERACIONES ESPECÍFICAS:\n${assetGuidance}`;
  }

  return prompt;
}

// ============================================================
// GUIDANCE ESPECÍFICO POR TIPO DE ACTIVO
// ============================================================

/**
 * Retorna consideraciones técnicas específicas para cada tipo de activo en GIMA.
 *
 * QUÉ HACE:
 *   Proporciona al LLM recordatorios técnicos clave para cada tipo de equipo.
 *   Estos no son los ítems del checklist en sí, sino hints que guían al modelo
 *   hacia las áreas de mayor importancia para cada categoría de activo.
 *
 * POR QUÉ EXISTE (y no confiar solo en el LLM):
 *   Sin este guidance, el LLM genera checklists genéricos que omiten
 *   verificaciones críticas específicas del equipo. Por ejemplo:
 *   - Sin guidance, un checklist de caldera podría no incluir la verificación
 *     de válvulas de alivio, que es una verificación de seguridad crítica ASME.
 *   - Sin guidance, un checklist de panel eléctrico podría no mencionar
 *     Lockout/Tagout, que es obligatorio por OSHA 1910.147.
 *
 * MARCADORES "CRÍTICO:":
 *   Los ítems precedidos por "CRÍTICO:" son verificaciones de seguridad que
 *   el LLM debe incluir con `required: true` y en posición prioritaria.
 *
 * TIPO `_taskType` (prefijo de guion bajo):
 *   El parámetro `taskType` se recibe pero actualmente no modifica el guidance.
 *   El prefijo `_` es la convención del proyecto para parámetros reservados para
 *   uso futuro (ej: guidance diferente para correctivo vs preventivo).
 *
 * @param assetType - Tipo de activo del catálogo GIMA.
 * @param _taskType - Tipo de tarea (reservado para future guidance diferenciado por tarea).
 * @returns String con consideraciones técnicas específicas, o '' si el tipo es desconocido.
 */
function getAssetSpecificGuidance(assetType: AssetType, _taskType: TaskType): string {
  const guidance: Record<AssetType, string> = {
    'unidad-hvac': `- Verificar filtros de aire
- Revisar niveles de refrigerante
- Comprobar funcionamiento de ventiladores
- Medir temperatura de descarga`,

    caldera: `- CRÍTICO: Verificar sistemas de seguridad
- Revisar presión de operación
- Inspeccionar nivel de agua
- Verificar válvulas de alivio`,

    bomba: `- Verificar alineación
- Revisar sellos mecánicos
- Comprobar vibración
- Verificar temperatura de cojinetes`,

    compresor: `- Verificar presión de descarga
- Revisar nivel de aceite
- Comprobar temperatura
- Inspeccionar válvulas`,

    generador: `- Verificar nivel de combustible
- Revisar sistema de enfriamiento
- Comprobar baterías
- Verificar transferencia automática`,

    'panel-electrico': `- CRÍTICO: Lockout/Tagout antes de trabajar
- Verificar conexiones
- Revisar temperatura de componentes
- Comprobar tierra física`,

    transportador: `- Verificar tensión de banda/cadena
- Revisar rodillos
- Comprobar alineación
- Lubricar puntos de fricción`,

    grua: `- CRÍTICO: Inspección de cables y ganchos
- Verificar frenos
- Comprobar límites de carga
- Revisar sistema hidráulico`,

    montacargas: `- Verificar frenos
- Revisar nivel de aceite/batería
- Comprobar horquillas
- Verificar luces y alarmas`,

    // Activos no clasificados: guidance genérico siguiendo mejores prácticas básicas
    otro: `- Seguir mejores prácticas generales de mantenimiento
- Enfocarse en seguridad primero
- Verificar componentes críticos`,
  };

  return guidance[assetType] || '';
}

// ============================================================
// PROMPT DE REINTENTO
// ============================================================

/**
 * Prompt de reintento cuando el LLM genera una respuesta con formato JSON inválido.
 *
 * CUÁNDO SE USA:
 *   ChecklistAIService intenta parsear la respuesta del LLM con JSON.parse().
 *   Si el parse falla (el LLM incluyó markdown, texto explicativo o JSON malformado),
 *   el servicio hace un segundo intento enviando este prompt como mensaje de usuario
 *   con la instrucción explícita de corregir el formato.
 *
 * POR QUÉ UN PROMPT ESPECÍFICO Y NO SIMPLEMENTE REINTENTAR:
 *   Reintentar con el mismo prompt produciría el mismo error.
 *   Este prompt reformula la instrucción haciendo más énfasis en las restricciones
 *   de formato que el LLM ignoró en el primer intento:
 *   - Recuerda explícitamente las categorías válidas (el error más común es inventar nuevas).
 *   - Reitera el rango de items permitidos.
 *   - Indica que "required" debe ser booleano (algunos LLMs lo envían como string "true").
 *
 * IMPLEMENTACIÓN EN EL SERVICIO:
 *   ```typescript
 *   const result = JSON.parse(response); // Falla
 *   // → segundo intento con CHECKLIST_RETRY_PROMPT como mensaje de usuario
 *   ```
 */
export const CHECKLIST_RETRY_PROMPT = `El formato anterior fue inválido. Por favor genera de nuevo el checklist siguiendo EXACTAMENTE el formato JSON especificado.

Recuerda:
- Solo JSON, sin texto adicional
- Categorías válidas: seguridad, operacion, inspeccion-visual, mediciones, limpieza, lubricacion, ajustes, documentacion
- Incluir entre 8 y 15 items
- Marcar items críticos como "required": true`;
