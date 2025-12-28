'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { transformData } from '@/app/actions/data-transformation';
import { logger } from '@/app/lib/logger';

import type { TransformationRequest, TransformationResult, TransformationStatus } from '../types';

/**
 * Hook para manejar la lógica de negocio de Data Transformation.
 * Conecta la UI con el Server Action y gestiona los estados de carga y error.
 */
export function useDataTransformation() {
  const [status, setStatus] = useState<TransformationStatus>('idle');
  const [result, setResult] = useState<TransformationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ejecuta el análisis y transformación de datos en modo Dry-Run (Preview)
   */
  const processTransformation = useCallback(async (request: TransformationRequest) => {
    setStatus('analyzing');
    setError(null);
    setResult(null);

    try {
      const response = await transformData(request);

      if (!response.success) {
        throw new Error(response.error || 'Error desconocido en la transformación');
      }

      setResult(response as TransformationResult);
      setStatus('previewing');
      logger.info('Transformation analysis successful', { stats: response.stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar datos';
      setError(message);
      setStatus('error');
      toast.error('Error de Transformación', { description: message });
      logger.error('Transformation failed', err instanceof Error ? err : new Error(message));
    }
  }, []);

  /**
   * Confirma y "aplica" la transformación (Commit)
   * En esta fase, podría guardar snapshot o descargar archivo
   */
  const applyTransformation = useCallback(async () => {
    if (!result) return;

    setStatus('uploading'); // Reusing uploading state for "Saving/Applying"

    try {
      // Aquí iría lógica futura de persistencia
      // Por ahora simulamos éxito inmediato
      await new Promise((resolve) => setTimeout(resolve, 500));

      setStatus('completed');
      toast.success('Transformación aplicada correctamente');
    } catch {
      setError('Error al guardar cambios');
      setStatus('previewing'); // Volver a preview si falla save
    }
  }, [result]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    result,
    error,
    processTransformation,
    applyTransformation,
    reset,
  };
}
