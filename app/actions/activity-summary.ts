'use server';

import type { ActivitySummaryRequest } from '@/app/lib/schemas/activity-summary.schema';
import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';

const summaryService = new ActivitySummaryAIService();

/**
 * Server Action para generar resúmenes de actividades.
 * Evita que el cliente importe directamente el servicio que requiere env vars de servidor.
 * @param request - Parámetros de generación del resumen
 */
export async function generateActivitySummary(request: ActivitySummaryRequest) {
  return summaryService.generateSummary(request);
}
