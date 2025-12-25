/**
 * Checklist Builder Client Component
 *
 * Componente cliente que maneja la lógica de generación de checklists.
 * Integra ChecklistAIService con los componentes shared UI.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  AIToolLayout,
  AIGenerationForm,
  AIPreviewCard,
  AIHistoryList,
  AIUsageStats,
  type FormField,
  type HistoryItem,
  type FeatureUsage,
} from '@/app/components/features/ai-tools/shared';
import { CheckCircle2 } from 'lucide-react';
import { generateChecklist } from '@/app/actions/checklist';
import type {
  Checklist,
  ChecklistGenerationRequest,
} from '@/app/components/features/checklist-builder/types';
import { ASSET_TYPES, TASK_TYPES, type AssetType, type TaskType } from '@/app/constants/ai';
import { useToast } from '@/app/hooks/use-toast';

/**
 * Form fields para generación de checklist
 */
const formFields: FormField[] = [
  {
    name: 'assetType',
    label: 'Tipo de Activo',
    type: 'select',
    required: true,
    options: ASSET_TYPES.map((type) => ({
      value: type,
      label: type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    })),
    placeholder: 'Selecciona el tipo de equipo',
    helpText: 'Tipo de equipo o activo para el mantenimiento',
  },
  {
    name: 'taskType',
    label: 'Tipo de Mantenimiento',
    type: 'select',
    required: true,
    options: TASK_TYPES.map((type) => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    })),
    placeholder: 'Selecciona el tipo de tarea',
    helpText: 'Tipo de mantenimiento a realizar',
  },
  {
    name: 'customInstructions',
    label: 'Instrucciones Personalizadas',
    type: 'textarea',
    required: false,
    maxLength: 500,
    placeholder: 'Ej: Incluir verificación de temperatura y presión en cada paso',
    helpText: 'Instrucciones adicionales para personalizar el checklist',
  },
  {
    name: 'context',
    label: 'Contexto Adicional',
    type: 'text',
    required: false,
    maxLength: 200,
    placeholder: 'Ej: Planta de producción, área 2, modelo ABC-123',
    helpText: 'Información de contexto relevante',
  },
];

export function ChecklistBuilderClient() {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usageCount, setUsageCount] = useState(0);

  // Stats de uso para mostrar
  const usageFeatures: FeatureUsage[] = useMemo(() => [
    { name: 'Checklists', used: usageCount, quota: 100, trend: 'up' as const },
  ], [usageCount]);

  // Reset date (primer día del próximo mes)
  const resetDate = useMemo(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }, []);

  const handleGenerate = async (data: Record<string, unknown>) => {
    setIsGenerating(true);
    setChecklist(null);

    try {
      const request: ChecklistGenerationRequest = {
        assetType: data.assetType as AssetType,
        taskType: data.taskType as TaskType,
        customInstructions: data.customInstructions as string | undefined,
        context: data.context as string | undefined,
      };

      const result = await generateChecklist(request);

      if (result.success && result.checklist) {
        setChecklist(result.checklist);
        setUsageCount((prev) => prev + 1);

        // Agregar al historial
        const historyItem: HistoryItem = {
          id: result.checklist.id,
          title: result.checklist.title,
          createdAt: result.checklist.createdAt,
          preview: `${result.checklist.items.length} items - ${request.assetType}`,
          metadata: result.checklist.metadata,
        };
        setHistory((prev) => [historyItem, ...prev].slice(0, 20));

        toast({
          title: result.cached ? '✨ Checklist cargado del caché' : '✅ Checklist generado',
          description: `${result.checklist.items.length} items creados`,
        });
      } else {
        throw new Error(result.error || 'Error al generar checklist');
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
    if (!checklist) return;

    // TODO: Guardar checklist en DB
    toast({
      title: '✅ Checklist guardado',
      description: 'El checklist ha sido guardado exitosamente',
    });
    setChecklist(null);
  };

  const handleReject = () => {
    setChecklist(null);
    toast({
      title: 'Checklist descartado',
      description: 'Puedes generar uno nuevo',
    });
  };

  const handleRegenerate = async () => {
    // Regenerar con los mismos parámetros
    if (checklist) {
      await handleGenerate({
        assetType: checklist.assetType,
        taskType: checklist.taskType,
      });
    }
  };

  const handleHistoryItemClick = (item: HistoryItem) => {
    // Cargar checklist del historial
    toast({
      title: 'Cargando checklist',
      description: `Cargando "${item.title}" del historial`,
    });
  };

  const handleHistoryItemDelete = (item: HistoryItem) => {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    toast({
      title: 'Item eliminado',
      description: 'El checklist ha sido eliminado del historial',
    });
  };

  const handleBulkDelete = (items: HistoryItem[]) => {
    const idsToDelete = new Set(items.map((i) => i.id));
    setHistory((prev) => prev.filter((h) => !idsToDelete.has(h.id)));
    toast({
      title: 'Items eliminados',
      description: `${items.length} checklists eliminados del historial`,
    });
  };

  return (
    <AIToolLayout
      title="Checklist Builder"
      description="Genera checklists de mantenimiento personalizados con inteligencia artificial"
      icon={<CheckCircle2 className="h-8 w-8" />}
      stats={{
        used: usageCount,
        quota: 100,
        resetDate,
        costEstimate: `$${(usageCount * 0.02).toFixed(2)}`,
      }}
      helpContent={
        <div className="space-y-2 text-sm">
          <p><strong>¿Cómo funciona?</strong></p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Selecciona el tipo de activo</li>
            <li>Elige el tipo de mantenimiento</li>
            <li>Agrega instrucciones personalizadas (opcional)</li>
            <li>Haz clic en &quot;Generar Checklist&quot;</li>
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
          title="Generar Checklist"
          description="Completa los datos para generar un checklist personalizado"
          fields={formFields}
          onSubmit={handleGenerate}
          isGenerating={isGenerating}
          submitLabel="Generar Checklist"
          saveDrafts
          draftId="checklist-builder"
        />

        <AIUsageStats
          features={usageFeatures}
          resetDate={resetDate}
        />
      </div>

      {/* Right Column - Preview & History */}
      <div className="space-y-6">
        {checklist ? (
          <AIPreviewCard
            title={checklist.title}
            content={
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{checklist.description}</p>
                <div className="space-y-2">
                  {checklist.items.map((item, index) => (
                    <div key={item.id} className="flex gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
            metadata={{
              generatedAt: checklist.createdAt,
              wordCount: checklist.items.reduce((acc, i) => acc + i.description.split(' ').length, 0),
              model: 'llama-3.3-70b',
            }}
            actions={{
              onAccept: handleAccept,
              onReject: handleReject,
              onRegenerate: handleRegenerate,
            }}
            exportData={{
              title: checklist.title,
              description: checklist.description,
              items: checklist.items,
              assetType: checklist.assetType,
              taskType: checklist.taskType,
            }}
          />
        ) : (
          <AIHistoryList
            title="Checklists Generados"
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
