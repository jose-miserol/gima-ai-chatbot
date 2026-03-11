/**
 * @file activity-summary.ts
 * @module app/actions/activity-summary
 *
 * ============================================================
 * SERVER ACTION — GENERACIÓN DE RESÚMENES DE ACTIVIDADES
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la Server Action `generateActivitySummary`, que actúa como
 *   intermediario delgado entre la UI de Next.js y el
 *   servicio de IA `ActivitySummaryAIService`.
 *   Recibe parámetros de generación y retorna un resumen narrativo de
 *   las actividades de mantenimiento registradas en GIMA.
 *
 * CONTEXTO EN GIMA:
 *   Los supervisores y gerentes necesitan reportes consolidados de las
 *   actividades realizadas en un período (turno, semana, mes). En lugar
 *   de exportar y leer tablas de datos, esta acción genera un resumen
 *   en lenguaje natural con los puntos más relevantes:
 *   - Órdenes de trabajo completadas / pendientes / con incidencias.
 *   - Equipos con mayor actividad o en estado crítico.
 *   - Alertas o patrones detectados en el período.
 *
 * POR QUÉ ES UN THIN WRAPPER (solo delega al servicio):
 *   En Next.js 15+, los Server Components y Client Components NO pueden
 *   importar directamente módulos que usan variables de entorno del servidor
 *   (como API keys) — causaría que esas variables se expusieran al bundle
 *   del cliente o errores en el build.
 *
 *   Al poner la lógica en `ActivitySummaryAIService` y envolverla aquí con
 *   'use server', garantizamos que:
 *   - El servicio solo corre en el servidor (GOOGLE_GENERATIVE_AI_API_KEY segura).
 *   - Los componentes pueden llamar a esta action sin importar el servicio.
 *   - La lógica de negocio queda en el servicio (separación de responsabilidades).
 *
 * INSTANCIACIÓN A NIVEL DE MÓDULO:
 *   `summaryService` se crea fuera de la función. En Next.js con Server Actions,
 *   esto significa que la instancia se reutiliza entre llamadas en el mismo
 *   proceso del servidor (comportamiento similar a un singleton ligero).
 *   Esto evita la sobrecarga de reinstanciar el servicio en cada petición.
 */

'use server';

// Tipo del request validado por Zod en la capa de schema.
// Se importa solo el tipo (no el schema completo) porque la validación
// ocurre dentro del servicio, no en esta capa de acción.
import type { ActivitySummaryRequest } from '@/app/lib/schemas/activity-summary.schema';

// Servicio que encapsula toda la lógica de IA:
// - Construcción del prompt con los datos de actividad
// - Llamada a Gemini para generación del resumen
// - Validación y formateo de la respuesta
import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';

// Instancia del servicio creada a nivel de módulo (fuera de la función).
// Se reutiliza entre llamadas en el mismo proceso del servidor Next.js,
// evitando el costo de inicialización en cada request.
const summaryService = new ActivitySummaryAIService();

/**
 * Genera un resumen narrativo de actividades de mantenimiento usando IA.
 *
 * QUÉ HACE:
 *   Delega completamente la generación al `ActivitySummaryAIService`.
 *   Esta función existe únicamente para exponer el servicio de servidor
 *   como una Server Action invocable desde componentes cliente.
 *
 * CÓMO FUNCIONA:
 *   1. Recibe el request tipado (validación previa en el cliente o en el servicio).
 *   2. Llama a `summaryService.generateSummary(request)`.
 *   3. Retorna directamente el resultado del servicio (sin transformación adicional).
 *
 * QUIÉN LA LLAMA:
 *   Componentes de dashboard que necesitan un resumen de actividades,
 *   típicamente en respuesta a una selección de rango de fechas o turno.
 *
 * @param request - Parámetros de generación del resumen. Ver ActivitySummaryRequest
 *                  para los campos disponibles (dateRange, userId, etc.).
 * @returns Promesa con el resultado de `ActivitySummaryAIService.generateSummary()`.
 *          El tipo exacto está definido en el servicio.
 */
export async function generateActivitySummary(request: ActivitySummaryRequest) {
  // Delegación directa al servicio. No hay lógica adicional aquí de forma intencional:
  // cualquier transformación, validación o manejo de errores es responsabilidad
  // del servicio, que tiene visibilidad completa del dominio de actividades.
  return summaryService.generateSummary(request);
}
