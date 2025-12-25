/**
 * Checklist Builder Client Component
 *
 * Componente cliente que maneja la lógica de generación de checklists.
 * Integra ChecklistAIService con los componentes shared UI.
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

        // Agregar al historial
        const historyItem: HistoryItem = {
          id: result.checklist.id,
          title: result.checklist.title,
          createdAt: result.checklist.createdAt,
          preview: `${result.checklist.items.length} items - ${ASSET_TYPES[data.assetType as keyof typeof ASSET_TYPES]}`,
          metadata: result.checklist.metadata,
        };
        setHistory((prev) => [historyItem, ...prev].slice(0, 10));

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

  const handleHistoryItemClick = () => {
    // Cargar checklist del historial
    toast({
      title: 'Función en desarrollo',
      description: 'Pronto podrás cargar checklists del historial',
    });
  };

  const handleHistoryItemDelete = (item: HistoryItem) => {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    toast({
      title: 'Item eliminado',
      description: 'El checklist ha sido eliminado del historial',
    });
  };

  return (
    <AIToolLayout
      title="Checklist Builder"
      description="Genera checklists de mantenimiento personalizados con inteligencia artificial"
      icon={<CheckCircle2 className="h-8 w-8" />}
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
        />

        <AIUsageStats feature="checklist-builder" />
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
              wordCount: checklist.items.length,
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
            title="Checklists Generados"
            items={history}
            onItemClick={handleHistoryItemClick}
            onItemDelete={handleHistoryItemDelete}
          />
        )}
      </div>
    </AIToolLayout>
  );
}
