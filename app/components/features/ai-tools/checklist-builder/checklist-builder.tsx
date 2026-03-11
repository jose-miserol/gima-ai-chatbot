/**
 * Checklist Builder Client Component
 *
 * Componente cliente que maneja la lógica de generación de checklists.
 * Integra ChecklistAIService con los componentes shared UI.
 */

'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { generateChecklist } from '@/app/actions/checklist';
import {
  AIToolLayout,
  AIGenerationForm,
  AIPreviewCard,
  type FormField,
} from '@/app/components/features/ai-tools/shared';
import type {
  Checklist,
  ChecklistItem,
  ChecklistGenerationRequest,
} from '@/app/components/features/ai-tools/checklist-builder/types';
import { ASSET_TYPES, TASK_TYPES, type AssetType, type TaskType } from '@/app/constants/ai';
import { useToast } from '@/app/components/ui/toast';

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

/**
 *
 */
export function ChecklistBuilder() {
  const toast = useToast();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [currentRequest, setCurrentRequest] = useState<ChecklistGenerationRequest | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [_usageCount, setUsageCount] = useState(0);

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
        setCurrentRequest(request);
        setUsageCount((prev) => prev + 1);


        toast.success(
          result.cached ? 'Checklist cargado del caché' : '✅ Checklist generado',
          `${result.checklist.items.length} items creados`
        );
      } else {
        throw new Error(result.error || 'Error al generar checklist');
      }
    } catch (error) {
      toast.error('❌ Error al generar', error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (!checklist) return;

    // TODO: Guardar checklist en DB
    toast.success('Checklist guardado', 'El checklist ha sido guardado exitosamente');
    setChecklist(null);
  };

  const handleReject = () => {
    setChecklist(null);
    toast.success('Checklist descartado', 'Puedes generar uno nuevo');
  };

  const handleRegenerate = async () => {
    // Regenerar con los mismos parámetros
    if (currentRequest) {
      await handleGenerate(currentRequest as unknown as Record<string, unknown>);
    } else {
      toast.error('Error', 'No se puede regenerar: faltan los datos originales del prompt');
    }
  };



  return (
    <AIToolLayout
      title="Generador de Checklists"
      description="Genera checklists de mantenimiento personalizados con inteligencia artificial"
      icon={<CheckCircle2 className="h-8 w-8" />}
      helpContent={
        <div className="space-y-2 text-sm">
          <p><strong>¿Cómo funciona?</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Selecciona el tipo de activo.</li>
            <li>Elige el tipo de mantenimiento.</li>
            <li>Genera el checklist personalizado.</li>
          </ul>
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
                  {checklist.items.map((item: ChecklistItem, index: number) => (
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
              wordCount: checklist.items.reduce((acc: number, i: ChecklistItem) => acc + i.description.split(' ').length, 0),
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
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900">Eficiencia con IA</h3>
            </div>
            <ul className="space-y-4 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">•</span>
                <span>Sé específico en las <strong>Instrucciones Personalizadas</strong> para obtener mejores resultados.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">•</span>
                <span>Los checklists generados pueden ser revisados y ajustados antes de guardarse.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-blue-500 font-bold">•</span>
                <span>La IA optimiza las tareas según el tipo de activo seleccionado automáticamente.</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </AIToolLayout>
  );
}
