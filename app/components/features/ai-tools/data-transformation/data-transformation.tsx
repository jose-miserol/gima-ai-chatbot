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
import { useState, useCallback } from 'react';

import { AIToolLayout } from '@/app/components/features/ai-tools/shared';
import { DataTransformationForm } from '@/app/components/features/ai-tools/data-transformation/data-transformation-form';
import { DataTransformationPreview } from '@/app/components/features/ai-tools/data-transformation/data-transformation-preview';
import { useDataTransformation } from '@/app/components/features/ai-tools/data-transformation/hooks/use-data-transformation';

import type { TransformationRequest } from '@/app/components/features/ai-tools/data-transformation/types';

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

    const handleAnalyze = useCallback(
        async (data: TransformationRequest) => {
            setOriginalData(data.sourceData);
            setRestoredData(undefined); // Clear restored on new analysis
            await processTransformation(data);
        },
        [processTransformation]
    );

    const handleApply = useCallback(async () => {
        await applyTransformation();

        setTimeout(() => {
            setOriginalData('');
            reset();
        }, 1500);
    }, [applyTransformation, reset]);

    const handleReject = useCallback(() => {
        reset();
    }, [reset]);



    return (
        <AIToolLayout
            title="Transformación de Datos"
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
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Database className="h-5 w-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Consejos de Uso</h3>
                        </div>
                        <ul className="space-y-4 text-sm text-gray-600">
                            <li className="flex gap-3">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>Funciona con <strong>CSV, JSON</strong> y texto plano sin formato.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>Soporta transformaciones complejas como limpieza de duplicados y re-formateo.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>Siempre previsualiza los cambios antes de aplicarlos definitivamente.</span>
                            </li>
                        </ul>
                    </div>
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
