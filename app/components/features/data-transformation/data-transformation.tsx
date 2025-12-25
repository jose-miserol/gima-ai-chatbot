'use client';

import { useState, useCallback } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { DataTransformationForm } from './data-transformation-form';
import { DataTransformationPreview } from './data-transformation-preview';
import { DataHistoryView } from './data-history-view';
import { useDataTransformation } from './hooks/use-data-transformation';
import { useDataSnapshots } from './hooks/use-data-snapshots';
import type { DataSnapshot } from './types';

/**
 * Componente principal de Data Transformation
 *
 * Orquesta el flujo completo usando useDataTransformation y useDataSnapshots:
 * 1. Form submit -> Análisis (Server Action con Gemini)
 * 2. Preview -> Visualización y aceptación
 * 3. Apply -> Guardado con snapshot automático
 * 4. History -> Visualización y restauración de versiones
 */
export function DataTransformation() {
  const [originalData, setOriginalData] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoredData, setRestoredData] = useState<string | undefined>(undefined);

  // Hooks
  const { status, result, processTransformation, applyTransformation, reset } =
    useDataTransformation();

  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot, clearHistory } =
    useDataSnapshots();

  const handleAnalyze = useCallback(
    async (data: { sourceData: string }) => {
      setOriginalData(data.sourceData);
      setRestoredData(undefined); // Clear restored on new analysis
      await processTransformation(data);
    },
    [processTransformation]
  );

  const handleApply = useCallback(async () => {
    // Crear snapshot ANTES de aplicar (preserva estado previo)
    if (originalData) {
      await createSnapshot(originalData);
    }

    await applyTransformation();

    setTimeout(() => {
      setOriginalData('');
      reset();
    }, 1500);
  }, [originalData, createSnapshot, applyTransformation, reset]);

  const handleReject = useCallback(() => {
    reset();
  }, [reset]);

  const handleRestore = useCallback(
    async (snapshot: DataSnapshot) => {
      // Restaurar datos al form
      setRestoredData(snapshot.originalData);
      setHistoryOpen(false);
      reset(); // Volver a idle para mostrar form con datos restaurados
    },
    [reset]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Transformación de Datos</h2>
          <p className="text-muted-foreground">
            Limpia, formatea y transforma tus datos usando instrucciones en lenguaje natural.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          disabled={snapshots.length === 0}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          Historial ({snapshots.length})
        </Button>
      </div>

      {(status === 'idle' || status === 'analyzing' || status === 'error') && (
        <DataTransformationForm
          onSubmit={handleAnalyze}
          isProcessing={status === 'analyzing'}
          initialSourceData={restoredData}
        />
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

      <DataHistoryView
        snapshots={snapshots}
        onRestore={handleRestore}
        onDelete={deleteSnapshot}
        onClear={clearHistory}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
