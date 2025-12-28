/**
 * Prompts para generación de checklists de mantenimiento
 *
 * Define los prompts usados por ChecklistAIService para generar
 * checklists personalizados según tipo de activo y tarea.
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

/**
 * System prompt base para generación de checklists
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

/**
 * Genera prompt específico para un tipo de activo y tarea
 * @param assetType - Tipo de activo
 * @param taskType - Tipo de tarea de mantenimiento
 * @param customInstructions - Instrucciones adicionales del usuario
 * @returns Prompt formateado
 */
export function buildChecklistPrompt(
  assetType: AssetType,
  taskType: TaskType,
  customInstructions?: string
): string {
  const assetName = assetType.replace('-', ' ');
  const taskName = taskType;

  let prompt = `Genera un checklist de mantenimiento ${taskName} para: ${assetName}

El checklist debe contener entre 8 y 15 items.`;

  if (customInstructions) {
    prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO:\n${customInstructions}`;
  }

  // Agregar guidance específico por tipo de activo
  const assetGuidance = getAssetSpecificGuidance(assetType, taskType);
  if (assetGuidance) {
    prompt += `\n\nCONSIDERACIONES ESPECÍFICAS:\n${assetGuidance}`;
  }

  return prompt;
}

/**
 * Retorna guidance específico por tipo de activo
 * @param assetType
 * @param taskType
 */
function getAssetSpecificGuidance(assetType: AssetType, taskType: TaskType): string {
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

    otro: `- Seguir mejores prácticas generales de mantenimiento
- Enfocarse en seguridad primero
- Verificar componentes críticos`,
  };

  return guidance[assetType] || '';
}

/**
 * Prompt para cuando la IA genera algo inválido (retry)
 */
export const CHECKLIST_RETRY_PROMPT = `El formato anterior fue inválido. Por favor genera de nuevo el checklist siguiendo EXACTAMENTE el formato JSON especificado.

Recuerda:
- Solo JSON, sin texto adicional
- Categorías válidas: seguridad, operacion, inspeccion-visual, mediciones, limpieza, lubricacion, ajustes, documentacion
- Incluir entre 8 y 15 items
- Marcar items críticos como "required": true`;
