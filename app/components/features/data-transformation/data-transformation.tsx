/**
 * Data Transformation Client Component
 *
 * Cliente que maneja la transformación de datos usando AI.
 * Refactorizado para usar AIToolLayout y mantener consistencia con otras herramientas.
 *
 * **Why this exists:**
 * Provides a consistent UX for data transformation while preserving all existing
 * functionality (snapshots, history, preview).
 */

'use client';

import { Database } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

import { AIToolLayout, AIHistoryList, type HistoryItem } from '@/app/components/features/ai-tools/shared';
import { DataTransformationForm } from '@/app/components/features/data-transformation/data-transformation-form';
import { DataTransformationPreview } from '@/app/components/features/data-transformation/data-transformation-preview';
import { useDataSnapshots } from '@/app/components/features/data-transformation/hooks/use-data-snapshots';
import { useDataTransformation } from '@/app/components/features/data-transformation/hooks/use-data-transformation';

import type { TransformationRequest } from '@/app/components/features/data-transformation/types';

/**
 * Main Data Transformation Client Component
 *
 * @returns Client component with AIToolLayout integration
 */
export function DataTransformation() {
    const [originalData, setOriginalData] = useState<string>('');
    const [restoredData, setRestoredData] = useState<string | undefined>(undefined);

    // Hooks
    const { status, result, processTransformation, applyTransformation, reset } =
        useDataTransformation();

    const { snapshots, createSnapshot, deleteSnapshot } =
        useDataSnapshots();

    const handleAnalyze = useCallback(
        async (data: TransformationRequest) => {
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

    const historyItems: HistoryItem[] = useMemo(() => {
        return snapshots.map((snap) => ({
            id: snap.id,
            title: snap.name || 'Transformación sin nombre',
            createdAt: new Date(snap.timestamp),
            preview: snap.originalData.length > 100 ? `${snap.originalData.substring(0, 100)}...` : snap.originalData,
            fullData: snap
        }));
    }, [snapshots]);

    const handleHistoryItemClick = useCallback((item: HistoryItem) => {
        if (item.fullData) {
            setRestoredData(item.fullData.originalData);
            reset();
        }
    }, [reset]);

    const handleHistoryItemDelete = useCallback((item: HistoryItem) => {
        deleteSnapshot(item.id);
    }, [deleteSnapshot]);

    const handleBulkDelete = useCallback((items: HistoryItem[]) => {
        items.forEach((item) => deleteSnapshot(item.id));
    }, [deleteSnapshot]);

    return (
        <AIToolLayout
            title="Data Transformation"
            description="Limpia, formatea y transforma tus datos usando instrucciones en lenguaje natural"
            icon={<Database className="h-8 w-8" />}
            showAIBadge={true}
            helpContent={
                <div className="space-y-2 text-sm">
                    <p><strong>¿Cómo funciona?</strong></p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Pega tus datos (CSV, JSON, texto)</li>
                        <li>Describe la transformación que necesitas</li>
                        <li>La IA analiza y genera el resultado</li>
                        <li>Previsualiza y aplica los cambios</li>
                    </ul>
                    <p className="mt-2"><strong>💡 Ejemplos:</strong></p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>"Convierte a mayúsculas"</li>
                        <li>"Elimina filas duplicadas"</li>
                        <li>"Formatea como tabla"</li>
                    </ul>
                </div>
            }

        >
            {/* Left Column - Form */}
            <div className="space-y-6">
                <DataTransformationForm
                    onSubmit={handleAnalyze}
                    isProcessing={status === 'analyzing'}
                    initialSourceData={restoredData}
                />
            </div>

            {/* Right Column - Info/Tips OR Preview */}
            <div className="space-y-6">
                {(status === 'idle' || status === 'analyzing' || status === 'error') ? (
                    <AIHistoryList
                        title="Historial de Transformaciones"
                        items={historyItems}
                        onItemClick={handleHistoryItemClick}
                        onItemDelete={handleHistoryItemDelete}
                        onBulkDelete={handleBulkDelete}
                        showSearch
                        showFilters
                        emptyState={
                            <div className="bg-muted/50 rounded-lg p-6">
                                <h3 className="font-semibold mb-2">Consejos</h3>
                                <ul className="text-sm text-muted-foreground space-y-2">
                                    <li>✅ Funciona con CSV, JSON, y texto plano</li>
                                    <li>✅ Soporta transformaciones complejas</li>
                                    <li>✅ Historial automático de cambios</li>
                                    <li>✅ Vista previa antes de aplicar</li>
                                </ul>
                            </div>
                        }
                    />
                ) : (
                    <>
                        {(status === 'previewing' || status === 'uploading' || status === 'completed') && result && (
                            <DataTransformationPreview
                                originalData={originalData}
                                result={result}
                                onApply={handleApply}
                                onReject={handleReject}
                                isApplying={status === 'uploading'}
                            />
                        )}
                    </>
                )}
            </div>


        </AIToolLayout>
    );
}
