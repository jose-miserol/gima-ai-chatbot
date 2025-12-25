/**
 * useChecklistGenerator - Hook para generar checklists con IA
 *
 * Hook que integra ChecklistAIService con la UI.
 * Maneja estado de generación, errores y caching.
 */

'use client';

import { useState } from 'react';
import { ChecklistAIService } from '@/app/lib/services/checklist-ai-service';
import type { ChecklistGenerationRequest, Checklist } from '@/app/lib/schemas/checklist.schema';
import type { ChecklistGenerationState } from '../types';

/**
 * Hook para generar checklists con IA
 *
 * @returns Estado y función de generación
 *
 * @example
 * ```typescript
 * const { generate, isGenerating, checklist, error } = useChecklistGenerator();
 *
 * const handleGenerate = async () => {
 *   await generate({
 *     assetType: 'bomba',
 *     taskType: 'preventivo'
 *   });
 * };
 * ```
 */
export function useChecklistGenerator() {
  const [state, setState] = useState<ChecklistGenerationState>({
    isGenerating: false,
    checklist: null,
    error: null,
    progress: 0,
  });

  /**
   * Servicio de IA (instancia singleton)
   */
  const [service] = useState(() => new ChecklistAIService());

  /**
   * Genera un checklist con IA
   *
   * @param request - Parámetros de generación
   */
  const generate = async (request: ChecklistGenerationRequest): Promise<void> => {
    setState({
      isGenerating: true,
      checklist: null,
      error: null,
      progress: 10,
    });

    try {
      // Simular progreso
      setState((prev) => ({ ...prev, progress: 30 }));

      // Llamar al servicio
      const result = await service.generateChecklist(request);

      setState((prev) => ({ ...prev, progress: 90 }));

      if (result.success && result.checklist) {
        setState({
          isGenerating: false,
          checklist: result.checklist,
          error: null,
          progress: 100,
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error) {
      setState({
        isGenerating: false,
        checklist: null,
        error: error instanceof Error ? error : new Error('Error desconocido'),
        progress: 0,
      });
    }
  };

  /**
   * Reinicia el estado
   */
  const reset = (): void => {
    setState({
      isGenerating: false,
      checklist: null,
      error: null,
      progress: 0,
    });
  };

  return {
    ...state,
    generate,
    reset,
  };
}
