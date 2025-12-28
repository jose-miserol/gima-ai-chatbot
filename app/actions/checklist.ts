'use server';

import type { ChecklistGenerationRequest } from '@/app/lib/schemas/checklist.schema';
import { ChecklistAIService } from '@/app/lib/services/checklist-ai-service';

const checklistService = new ChecklistAIService();

/**
 * Server Action para generar checklists.
 * Evita que el cliente importe directamente el servicio que requiere env vars de servidor.
 * @param request
 */
export async function generateChecklist(request: ChecklistGenerationRequest) {
  return checklistService.generateChecklist(request);
}
