/**
 * @file checklist.ts
 * @module app/actions/checklist
 *
 * ============================================================
 * SERVER ACTION — GENERACIÓN DE CHECKLISTS CON IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la Server Action `generateChecklist`, que actúa como
 *   intermediario delgado (thin wrapper) entre la UI y el servicio
 *   `ChecklistAIService`, delegando la generación de listas de verificación
 *   inteligentes para mantenimiento preventivo, correctivo o inspecciones.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos necesitan checklists específicos para cada tipo de tarea.
 *   En lugar de usar plantillas genéricas, esta acción genera un checklist
 *   adaptado al equipo, tipo de mantenimiento y contexto proporcionado.
 *   Ejemplos de uso:
 *   - "Generar checklist de mantenimiento preventivo para compresor Sullair 30HP"
 *   - "Lista de verificación para cambio de aceite hidráulico en prensa neumática"
 *   - "Checklist de inspección de seguridad eléctrica para tablero de control"
 *
 * POR QUÉ ES UN THIN WRAPPER (igual que activity-summary.ts):
 *   En Next.js 15+, importar directamente `ChecklistAIService` desde un
 *   Client Component causaría que las variables de entorno del servidor
 *   (GOOGLE_GENERATIVE_AI_API_KEY) se intentaran incluir en el bundle
 *   del cliente, lo cual es un error de seguridad y de build.
 *
 *   La Server Action actúa como frontera de seguridad:
 *   - Todo lo que está "arriba" de 'use server' corre exclusivamente en el servidor.
 *   - Los Client Components pueden llamar a esta función como si fuera una API.
 *   - La lógica de IA y las API keys nunca llegan al navegador.
 *
 * INSTANCIACIÓN A NIVEL DE MÓDULO:
 *   `checklistService` se instancia una vez cuando el módulo es cargado por
 *   el runtime de Next.js. Se reutiliza en llamadas subsecuentes durante la
 *   vida del proceso del servidor (evita reinstanciar en cada request).
 *
 * DÓNDE SE CONSUME:
 *   - Componentes de formulario en app/components/features/checklist/
 *   - Re-exportado desde app/actions/index.ts (export *)
 *
 * TIPOS RELACIONADOS:
 *   - ChecklistGenerationRequest: definido en app/lib/schemas/checklist.schema.ts
 *     Incluye campos como: equipmentType, maintenanceType, context, items count.
 * ============================================================
 */

'use server';

// Tipo del request validado por Zod en la capa de schema.
// Se importa como `type` para garantizar que no se incluya código de runtime
// del schema en el bundle (solo la información de tipos para TypeScript).
import type { ChecklistGenerationRequest } from '@/app/lib/schemas/checklist.schema';

// Servicio que encapsula la lógica de generación de checklists:
// - Construcción del prompt con el contexto del equipo y tipo de mantenimiento
// - Llamada a Gemini para generar los ítems del checklist
// - Validación y estructuración de la respuesta
import { ChecklistAIService } from '@/app/lib/services/checklist-ai-service';

// Instancia del servicio creada a nivel de módulo.
// Se reutiliza entre llamadas para evitar el overhead de inicialización
// (carga de prompts, configuración del cliente de IA, etc.).
const checklistService = new ChecklistAIService();

/**
 * Genera un checklist de mantenimiento usando IA, adaptado al contexto dado.
 *
 * QUÉ HACE:
 *   Delega completamente la generación al `ChecklistAIService`.
 *   Existe como Server Action para que los Client Components puedan
 *   invocarla sin acceder directamente a servicios que requieren env vars
 *   del servidor.
 *
 * CÓMO FUNCIONA:
 *   1. Recibe el request tipado con los parámetros del checklist.
 *   2. Llama a `checklistService.generateChecklist(request)`.
 *   3. Retorna directamente el resultado del servicio.
 *
 * QUIÉN LA LLAMA:
 *   El formulario de creación/edición de órdenes de trabajo, cuando el
 *   técnico solicita generar automáticamente los pasos de verificación.
 *   También puede invocarse desde el asistente de chat de GIMA.
 *
 * @param request - Parámetros de generación del checklist. Ver ChecklistGenerationRequest
 *                  para los campos requeridos (tipo de equipo, tipo de mantenimiento, etc.).
 * @returns Promesa con el resultado de `ChecklistAIService.generateChecklist()`.
 *          Incluye los ítems del checklist y metadata de generación.
 */
export async function generateChecklist(request: ChecklistGenerationRequest) {
  // Delegación directa al servicio. El patrón thin wrapper es intencional:
  // mantener esta función simple facilita testing (solo hay que mockear el servicio)
  // y permite cambiar la implementación del servicio sin tocar esta capa.
  return checklistService.generateChecklist(request);
}
