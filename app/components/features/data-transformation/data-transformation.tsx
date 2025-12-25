'use client';

import { useState } from 'react';
import { DataTransformationForm } from './data-transformation-form';
import { DataTransformationPreview } from './data-transformation-preview';
import type { TransformationRequest, TransformationResult } from './types';
import { logger } from '@/app/lib/logger';

/**
 * Componente principal de Data Transformation
 *
 * Orquesta el flujo completo:
 * 1. Form submit -> Análisis (Mock por ahora)
 * 2. Preview -> Visualización y aceptación
 * 3. Apply -> Guardado (Mock por ahora)
 */
export function DataTransformation() {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'previewing' | 'applying'>('idle');
  const [originalData, setOriginalData] = useState<string>('');
  const [result, setResult] = useState<TransformationResult | null>(null);

  const handleAnalyze = async (request: TransformationRequest) => {
    setStatus('analyzing');
    setOriginalData(request.sourceData);

    // TODO: Replace with real service call in Sprint 5.2
    setTimeout(() => {
      // Mock logic for basic prototype
      const mockResult: TransformationResult = {
        success: true,
        data: {
          message: 'Datos transformados (Simulación)',
          originalLength: request.sourceData.length,
          instruction: request.instruction,
        },
        stats: { additions: 3, deletions: 0, durationMs: 450, itemsProcessed: 1 },
        timestamp: Date.now(),
      };
      setResult(mockResult);
      setStatus('previewing');
      logger.info('Analysis completed (mock)', { requestId: 'mock-123' });
    }, 1500);
  };

  const handleApply = () => {
    setStatus('applying');
    // TODO: Replace with real apply (save snapshot ?)
    setTimeout(() => {
      setStatus('idle');
      setResult(null);
      setOriginalData('');
      logger.info('Transformation applied (mock)');
    }, 1000);
  };

  const handleReject = () => {
    setStatus('idle');
    setResult(null);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Transformación de Datos</h2>
        <p className="text-muted-foreground">
          Limpia, formatea y transforma tus datos usando instrucciones en lenguaje natural (Dry-Run
          Mode activo).
        </p>
      </div>

      {status !== 'previewing' && status !== 'applying' && (
        <DataTransformationForm onSubmit={handleAnalyze} isProcessing={status === 'analyzing'} />
      )}

      {(status === 'previewing' || status === 'applying') && result && (
        <DataTransformationPreview
          originalData={originalData}
          result={result}
          onApply={handleApply}
          onReject={handleReject}
          isApplying={status === 'applying'}
        />
      )}
    </div>
  );
}
