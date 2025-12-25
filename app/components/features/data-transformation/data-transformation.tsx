'use client';

import { useState } from 'react';
import { DataTransformationForm } from './data-transformation-form';
import { DataTransformationPreview } from './data-transformation-preview';
import { useDataTransformation } from './hooks/use-data-transformation';

/**
 * Componente principal de Data Transformation
 *
 * Orquesta el flujo completo usando useDataTransformation:
 * 1. Form submit -> Análisis (Server Action con Gemini)
 * 2. Preview -> Visualización y aceptación
 * 3. Apply -> Guardado (Mock por ahora)
 */
export function DataTransformation() {
  const [originalData, setOriginalData] = useState<string>('');

  // Usar hook logic real
  const { status, result, processTransformation, applyTransformation, reset } =
    useDataTransformation();

  const handleAnalyze = async (data: any) => {
    setOriginalData(data.sourceData);
    await processTransformation(data);
  };

  const handleApply = async () => {
    await applyTransformation();
    // Opcional: limpiar data después de éxito, o dejar resultado visible
    setTimeout(() => {
      setOriginalData('');
      reset();
    }, 1500);
  };

  const handleReject = () => {
    reset();
    // Mantener form data si se quisiera (requeriría elevar estado del form)
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Transformación de Datos</h2>
        <p className="text-muted-foreground">
          Limpia, formatea y transforma tus datos usando instrucciones en lenguaje natural (Powered
          by Gemini).
        </p>
      </div>

      {(status === 'idle' || status === 'analyzing' || status === 'error') && (
        <DataTransformationForm onSubmit={handleAnalyze} isProcessing={status === 'analyzing'} />
      )}

      {(status === 'previewing' || status === 'uploading' || status === 'completed') && result && (
        <DataTransformationPreview
          originalData={originalData}
          result={result}
          onApply={handleApply}
          onReject={handleReject}
          isApplying={status === 'uploading'}
        />
      )}
    </div>
  );
}
