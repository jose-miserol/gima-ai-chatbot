/**
 * useCloseoutGenerator - Hook para generar notas de cierre con IA
 *
 * Hook personalizado para manejar el estado de generación
 * de notas de cierre usando WorkOrderCloseoutAIService.
 */

'use client';

import { useState, useRef } from 'react';
import { WorkOrderCloseoutAIService } from '@/app/lib/services/work-order-closeout-ai-service';
import type { CloseoutNotesRequest } from '@/app/lib/schemas/work-order-closeout.schema';
import type { CloseoutNotes } from '../types';

/**
 * Hook para generar notas de cierre con IA
 */
export function useCloseoutGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState<CloseoutNotes | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  // Singleton del servicio
  const serviceRef = useRef<WorkOrderCloseoutAIService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new WorkOrderCloseoutAIService();
  }

  /**
   * Genera notas de cierre
   */
  const generate = async (request: CloseoutNotesRequest) => {
    setIsGenerating(true);
    setError(null);
    setNotes(null);
    setProgress(0);

    try {
      setProgress(10);

      // Llamar al servicio
      setProgress(30);
      const result = await serviceRef.current!.generateCloseoutNotes(request);

      setProgress(90);

      if (!result.success) {
        throw new Error(result.error || 'Error al generar notas');
      }

      setNotes(result.notes!);
      setProgress(100);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Error desconocido');
      setError(errorObj);
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Resetea el estado
   */
  const reset = () => {
    setNotes(null);
    setError(null);
    setProgress(0);
  };

  return {
    isGenerating,
    notes,
    error,
    progress,
    generate,
    reset,
  };
}
