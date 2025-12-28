'use client';

import { useState, useRef } from 'react';

import type { ActivitySummaryRequest } from '@/app/lib/schemas/activity-summary.schema';
import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';

import type { ActivitySummary } from '../types';

/**
 * Hook para generar resúmenes con IA
 * @returns Estado y funciones de generación
 */
export function useSummaryGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  // Singleton del servicio
  const serviceRef = useRef<ActivitySummaryAIService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new ActivitySummaryAIService();
  }

  /**
   * Genera un resumen de actividades
   * @param request - Parámetros de generación
   */
  const generate = async (request: ActivitySummaryRequest) => {
    setIsGenerating(true);
    setError(null);
    setSummary(null);
    setProgress(0);

    try {
      // Simular progreso
      setProgress(10);

      // Llamar al servicio
      setProgress(30);
      const service = serviceRef.current;
      if (!service) {
        throw new Error('Service not initialized');
      }
      
      const result = await service.generateSummary(request);

      setProgress(90);

      if (!result.success) {
        throw new Error(result.error || 'Error al generar resumen');
      }

      // Actualizar estado
      if (result.summary) {
        setSummary(result.summary);
      }
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
   * Resetea el estado del hook
   */
  const reset = () => {
    setSummary(null);
    setError(null);
    setProgress(0);
  };

  return {
    isGenerating,
    summary,
    error,
    progress,
    generate,
    reset,
  };
}
