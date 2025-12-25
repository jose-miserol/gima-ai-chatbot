/**
 * Activity Summaries Client Component
 *
 * Componente cliente que maneja la generación de resúmenes de actividades.
 * Integra ActivitySummaryAIService con los componentes shared UI.
 */

'use client';

import { useState } from 'react';
import {
  AIToolLayout,
  AIGenerationForm,
  AIPreviewCard,
  AIHistoryList,
  AIUsageStats,
  type FormField,
  type HistoryItem,
} from '@/app/components/features/ai-tools/shared';
import { FileText } from 'lucide-react';
import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';
import type {
  ActivitySummaryRequest,
  ActivitySummary,
  SummaryStyle,
  DetailLevel,
} from '@/app/components/features/activity-summary/types';
import { ASSET_TYPES, TASK_TYPES, type AssetType, type TaskType } from '@/app/constants/ai';
import { useToast } from '@/app/hooks/use-toast';

const summaryService = new ActivitySummaryAIService();

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
  },
  {
    name: 'activities',
    label: 'Actividades Realizadas',
    type: 'textarea',
    required: true,
    maxLength: 2000,
    placeholder:
      'Describe las actividades realizadas. Ej: Revisión completa del sistema HVAC, limpieza de filtros, verificación de presiones...',
    helpText: 'Lista las actividades de mantenimiento completadas (máximo 2000 caracteres)',
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

export function ActivitySummariesClient() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
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

      const result = await summaryService.generateSummary(request);

      if (result.success && result.summary) {
        setSummary(result.summary);

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
          },
        };
        setHistory((prev) => [historyItem, ...prev].slice(0, 10));

        toast({
          title: result.cached ? '✨ Resumen cargado del caché' : '✅ Resumen generado',
          description: `${result.summary.metadata?.wordCount || 0} palabras - ${result.summary.metadata?.readingTime || 1} min lectura`,
        });
      } else {
        throw new Error(result.error || 'Error al generar resumen');
      }
    } catch (error) {
      toast({
        title: '❌ Error al generar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (!summary) return;

    // TODO: Guardar resumen en DB / exportar
    toast({
      title: '✅ Resumen guardado',
      description: 'El resumen ha sido guardado exitosamente',
    });
    setSummary(null);
  };

  const handleReject = () => {
    setSummary(null);
    toast({
      title: 'Resumen descartado',
      description: 'Puedes generar uno nuevo',
    });
  };

  const handleRegenerate = async () => {
    if (summary) {
      await handleGenerate({
        assetType: summary.assetType,
        taskType: summary.taskType,
        activities: '', // No guardamos las actividades originales
        style: summary.style,
        detailLevel: summary.detailLevel,
      });
    }
  };

  const handleHistoryItemClick = () => {
    toast({
      title: 'Función en desarrollo',
      description: 'Pronto podrás cargar resúmenes del historial',
    });
  };

  const handleHistoryItemDelete = (item: HistoryItem) => {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    toast({
      title: 'Item eliminado',
      description: 'El resumen ha sido eliminado del historial',
    });
  };

  return (
    <AIToolLayout
      title="Activity Summaries"
      description="Genera resúmenes profesionales de actividades de mantenimiento con inteligencia artificial"
      icon={<FileText className="h-8 w-8" />}
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
        />

        <AIUsageStats feature="activity-summaries" />
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
                    {/* Items removed - not in SummarySection type */}
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
          />
        ) : (
          <AIHistoryList
            title="Resúmenes Generados"
            items={history}
            onItemClick={handleHistoryItemClick}
            onItemDelete={handleHistoryItemDelete}
          />
        )}
      </div>
    </AIToolLayout>
  );
}
