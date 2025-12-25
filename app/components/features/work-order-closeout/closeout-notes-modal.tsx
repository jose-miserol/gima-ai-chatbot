/**
 * CloseoutNotesModal - Modal para generar notas de cierre con IA
 *
 * Modal reutilizable que puede integrarse en cualquier página de detalle de WO.
 * Usa shared components y WorkOrderCloseoutAIService.
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AIGenerationForm,
  AIPreviewCard,
  type FormField,
} from '@/app/components/features/ai-tools/shared';
import { WorkOrderCloseoutAIService } from '@/app/lib/services/work-order-closeout-ai-service';
import type {
  CloseoutNotesRequest,
  CloseoutNotes,
  CloseoutStyle,
  WorkOrderSummary,
} from '@/app/components/features/work-order-closeout/types';
import { useToast } from '@/app/hooks/use-toast';
import { Button } from '@/app/components/ui/button';
import { FileText } from 'lucide-react';

const closeoutService = new WorkOrderCloseoutAIService();

/**
 * Form fields para generación de notas de cierre
 */
const formFields: FormField[] = [
  {
    name: 'style',
    label: 'Estilo de Notas',
    type: 'select',
    required: true,
    defaultValue: 'formal',
    options: [
      { value: 'formal', label: 'Formal - Documentación oficial' },
      { value: 'technical', label: 'Técnico - Especificaciones detalladas' },
      { value: 'brief', label: 'Breve - Resumen conciso' },
    ],
    helpText: 'Estilo y nivel de detalle de las notas',
  },
  {
    name: 'includeRecommendations',
    label: 'Incluir recomendaciones',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Agregar recomendaciones para futuros trabajos',
  },
];

export interface CloseoutNotesModalProps {
  /**
   * Si el modal está abierto
   */
  open: boolean;

  /**
   * Callback para cerrar el modal
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Datos del work order
   */
  workOrderData: WorkOrderSummary;

  /**
   * Callback cuando las notas se aceptan
   */
  onNotesAccepted?: (notes: CloseoutNotes) => void;
}

/**
 * Modal para generar notas de cierre con IA
 */
export function CloseoutNotesModal({
  open,
  onOpenChange,
  workOrderData,
  onNotesAccepted,
}: CloseoutNotesModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<CloseoutNotes | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (data: Record<string, unknown>) => {
    setIsGenerating(true);
    setNotes(null);

    try {
      const request: CloseoutNotesRequest = {
        workOrderId: workOrderData.id,
        workOrderData,
        style: data.style as CloseoutStyle,
        includeRecommendations: data.includeRecommendations as boolean,
      };

      const result = await closeoutService.generateCloseoutNotes(request);

      if (result.success && result.notes) {
        setNotes(result.notes);

        toast({
          title: result.cached ? '✨ Notas cargadas del caché' : '✅ Notas generadas',
          description: `${result.notes.metadata?.wordCount || 0} palabras generadas`,
        });
      } else {
        throw new Error(result.error || 'Error al generar notas');
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
    if (!notes) return;

    onNotesAccepted?.(notes);
    toast({
      title: '✅ Notas guardadas',
      description: 'Las notas de cierre han sido agregadas al Work Order',
    });
    setNotes(null);
    onOpenChange(false);
  };

  const handleReject = () => {
    setNotes(null);
    toast({
      title: 'Notas descartadas',
      description: 'Puedes generar unas nuevas',
    });
  };

  const handleRegenerate = async () => {
    if (notes) {
      await handleGenerate({
        style: notes.style,
        includeRecommendations: !!notes.recommendations,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generar Notas de Cierre con IA
          </DialogTitle>
          <DialogDescription>
            Genera notas profesionales de cierre para: <strong>{workOrderData.title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Left Column - Form */}
          <div className="space-y-4">
            {/* Work Order Info */}
            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{workOrderData.taskType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activo:</span>
                <span className="font-medium">{workOrderData.assetType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actividades:</span>
                <span className="font-medium">{workOrderData.activities.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiempo:</span>
                <span className="font-medium">{workOrderData.timeSpent}h</span>
              </div>
            </div>

            {/* Generation Form */}
            <AIGenerationForm
              title="Configurar Notas"
              fields={formFields}
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              submitLabel="Generar Notas"
            />
          </div>

          {/* Right Column - Preview */}
          <div>
            {notes ? (
              <AIPreviewCard
                title="Notas de Cierre"
                content={
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Resumen</h4>
                      <p className="text-sm text-muted-foreground">{notes.summary}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Trabajo Realizado</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {notes.workPerformed}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Hallazgos</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {notes.findings}
                      </p>
                    </div>

                    {notes.recommendations && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Recomendaciones</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {notes.recommendations}
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Materiales</h4>
                      <p className="text-sm text-muted-foreground">{notes.materialsUsed}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2">Tiempo</h4>
                      <p className="text-sm text-muted-foreground">{notes.timeBreakdown}</p>
                    </div>

                    {notes.nextActions && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Próximas Acciones</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {notes.nextActions}
                        </p>
                      </div>
                    )}
                  </div>
                }
                metadata={{
                  generatedAt: notes.createdAt,
                  wordCount: notes.metadata?.wordCount,
                  model: 'llama-3.3-70b',
                }}
                actions={{
                  onAccept: handleAccept,
                  onReject: handleReject,
                  onRegenerate: handleRegenerate,
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <div>
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Las notas generadas aparecerán aquí</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
