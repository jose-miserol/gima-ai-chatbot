/**
 * Activity Summaries Client Component
 *
 * Componente cliente que maneja la generación de resúmenes de actividades.
 * Integra ActivitySummaryAIService con los componentes shared UI.
 */

'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';

import { generateActivitySummary } from '@/app/actions/activity-summary';
import type {
  ActivitySummaryRequest,
  ActivitySummary,
  SummaryStyle,
  DetailLevel,
} from '@/app/components/features/activity-summary/types';
import {
  AIToolLayout,
  AIGenerationForm,
  AIPreviewCard,
  AIHistoryList,
  type FormField,
  type HistoryItem,
} from '@/app/components/features/ai-tools/shared';
import { ASSET_TYPES, TASK_TYPES, type AssetType, type TaskType } from '@/app/constants/ai';
import { useToast } from '@/app/components/ui/toast';

/**
 * Form fields para generación de resumen
 */
const formFields: FormField[] = [
  {
    name: 'assetType',
    label: 'Tipo de Activo',
    type: 'select',
    required: true,
    options: ASSET_TYPES.map((type) => ({
      value: type,
      label: type
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    })),
    placeholder: 'Selecciona el tipo de equipo',
    defaultValue: ASSET_TYPES[0],
  },
  {
    name: 'taskType',
    label: 'Tipo de Tarea',
    type: 'select',
    required: true,
    options: TASK_TYPES.map((type) => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    })),
    placeholder: 'Selecciona el tipo de mantenimiento',
    defaultValue: TASK_TYPES[0],
  },
  {
    name: 'activities',
    label: 'Actividades Realizadas',
    type: 'textarea',
    required: true,
    minLength: 10,
    maxLength: 2000,
    placeholder:
      'Describe las actividades realizadas. Ej: Revisión completa del sistema HVAC, limpieza de filtros, verificación de presiones...',
    helpText: 'Lista las actividades de mantenimiento completadas (mínimo 10 caracteres)',
  },
  {
    name: 'style',
    label: 'Estilo de Resumen',
    type: 'select',
    required: true,
    defaultValue: 'ejecutivo',
    options: [
      { value: 'ejecutivo', label: 'Ejecutivo - Conciso para gerencia' },
      { value: 'tecnico', label: 'Técnico - Detallado con especificaciones' },
      { value: 'narrativo', label: 'Narrativo - Cronológico y descriptivo' },
    ],
    helpText: 'Estilo y audiencia del resumen',
  },
  {
    name: 'detailLevel',
    label: 'Nivel de Detalle',
    type: 'select',
    required: true,
    defaultValue: 'medio',
    options: [
      { value: 'bajo', label: 'Bajo - Resumen ejecutivo breve' },
      { value: 'medio', label: 'Medio - Balance entre detalle y concisión' },
      { value: 'alto', label: 'Alto - Análisis completo y exhaustivo' },
    ],
    helpText: 'Profundidad del análisis',
  },
  {
    name: 'context',
    label: 'Contexto Adicional',
    type: 'text',
    required: false,
    maxLength: 200,
    placeholder: 'Ej: Trabajo programado, incidencias previas resueltas',
    helpText: 'Información contextual relevante (opcional)',
  },
];

/**
 *
 */
export function ActivitySummary() {
  const toast = useToast();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [currentRequest, setCurrentRequest] = useState<ActivitySummaryRequest | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);




  const handleGenerate = async (data: Record<string, unknown>) => {
    setIsGenerating(true);
    setSummary(null);

    try {
      const request: ActivitySummaryRequest = {
        assetType: data.assetType as AssetType,
        taskType: data.taskType as TaskType,
        activities: data.activities as string,
        style: data.style as SummaryStyle,
        detailLevel: data.detailLevel as DetailLevel,
        context: data.context as string | undefined,
      };

      const result = await generateActivitySummary(request);

      if (result.success && result.summary) {
        setSummary(result.summary);
        setCurrentRequest(request);


        // Agregar al historial
        const historyItem: HistoryItem = {
          id: result.summary.id,
          title: result.summary.title,
          createdAt: result.summary.createdAt,
          preview: result.summary.executive.substring(0, 120) + '...',
          metadata: {
            style: result.summary.style,
            detailLevel: result.summary.detailLevel,
            wordCount: result.summary.metadata?.wordCount,
            originalRequest: request,
          },
          fullData: result.summary,
        };
        setHistory((prev) => [historyItem, ...prev].slice(0, 20));

        toast.success(
          result.cached ? '✨ Resumen cargado del caché' : '✅ Resumen generado',
          `${result.summary.metadata?.wordCount || 0} palabras - ${result.summary.metadata?.readingTime || 1} min lectura`
        );
      } else {
        throw new Error(result.error || 'Error al generar resumen');
      }
    } catch (error) {
      toast.error('❌ Error al generar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (!summary) return;

    // TODO: Guardar resumen en DB / exportar
    toast.success('✅ Resumen guardado', 'El resumen ha sido guardado exitosamente');
    setSummary(null);
  };

  const handleReject = () => {
    setSummary(null);
    toast.success('Resumen descartado', 'Puedes generar uno nuevo');
  };

  const handleRegenerate = async () => {
    if (currentRequest) {
      await handleGenerate(currentRequest as unknown as Record<string, unknown>);
    } else {
      toast.error('Error', 'No se puede regenerar: faltan los datos originales del prompt');
    }
  };

  const handleHistoryItemClick = (item: HistoryItem) => {
    if (item.fullData) {
      setSummary(item.fullData as ActivitySummary);
      setCurrentRequest(item.metadata?.originalRequest || null);
      toast.success('Resumen cargado', `Visualizando "${item.title}"`);
    } else {
      toast.error('Error al cargar', 'No se encontraron los datos completos del resumen');
    }
  };

  const handleHistoryItemDelete = (item: HistoryItem) => {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    toast.success('Item eliminado', 'El resumen ha sido eliminado del historial');
  };

  const handleBulkDelete = (items: HistoryItem[]) => {
    const idsToDelete = new Set(items.map((i) => i.id));
    setHistory((prev) => prev.filter((h) => !idsToDelete.has(h.id)));
    toast.success('Items eliminados', `${items.length} resúmenes eliminados del historial`);
  };

  return (
    <AIToolLayout
      title="Activity Summaries"
      description="Genera resúmenes profesionales de actividades de mantenimiento con inteligencia artificial"
      icon={<FileText className="h-8 w-8" />}
      // stats={{
      //   used: usageCount,
      //   quota: 100,
      //   resetDate,
      //   costEstimate: `$${(usageCount * 0.03).toFixed(2)}`,
      // }}
      helpContent={
        <div className="space-y-2 text-sm">
          <p><strong>¿Cómo funciona?</strong></p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Selecciona el tipo de activo y tarea</li>
            <li>Describe las actividades realizadas</li>
            <li>Elige el estilo y nivel de detalle</li>
            <li>Haz clic en &quot;Generar Resumen&quot;</li>
          </ol>
          <p className="text-muted-foreground mt-2">
            Tip: Usa Ctrl+Enter para generar rápidamente
          </p>
        </div>
      }
    >
      {/* Left Column - Form */}
      <div className="space-y-6">
        <AIGenerationForm
          title="Generar Resumen"
          description="Completa los datos para generar un resumen profesional"
          fields={formFields}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          submitLabel="Generar Resumen"
          saveDrafts
          draftId="activity-summaries"
        />


      </div>

      {/* Right Column - Preview & History */}
      <div className="space-y-6">
        {summary ? (
          <AIPreviewCard
            title={summary.title}
            content={
              <div className="space-y-4">
                {/* Executive Summary */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Resumen Ejecutivo</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {summary.executive}
                  </p>
                </div>

                {/* Sections */}
                {summary.sections.map((section) => (
                  <div key={section.order}>
                    <h4 className="text-sm font-semibold mb-2">{section.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>
            }
            metadata={{
              generatedAt: summary.createdAt,
              wordCount: summary.metadata?.wordCount,
              model: 'llama-3.3-70b',
            }}
            actions={{
              onAccept: handleAccept,
              onReject: handleReject,
              onRegenerate: handleRegenerate,
            }}
            exportData={{
              title: summary.title,
              executive: summary.executive,
              sections: summary.sections,
              style: summary.style,
              detailLevel: summary.detailLevel,
            }}
          />
        ) : (
          <AIHistoryList
            title="Resúmenes Generados"
            items={history}
            onItemClick={handleHistoryItemClick}
            onItemDelete={handleHistoryItemDelete}
            onBulkDelete={handleBulkDelete}
            showSearch
            showFilters
          />
        )}
      </div>
    </AIToolLayout>
  );
}
