/**
 * ChecklistBuilderForm - Formulario de generación
 *
 * Formulario para solicitar generación de checklist con IA.
 * Permite seleccionar tipo de activo, tarea e instrucciones custom.
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { ASSET_TYPES, TASK_TYPES } from '@/app/constants/ai';
import { useChecklistGenerator } from './hooks';
import type { Checklist } from './types';

interface ChecklistBuilderFormProps {
  /**
   * Callback cuando se genera un checklist exitosamente
   */
  onChecklistGenerated: (checklist: Checklist) => void;
}

export function ChecklistBuilderForm({ onChecklistGenerated }: ChecklistBuilderFormProps) {
  const [assetType, setAssetType] = useState<string>(ASSET_TYPES[0]);
  const [taskType, setTaskType] = useState<string>(TASK_TYPES[0]);
  const [customInstructions, setCustomInstructions] = useState('');

  const { generate, isGenerating, checklist, error } = useChecklistGenerator();

  // Notificar cuando el checklist esté listo
  useEffect(() => {
    if (checklist) {
      onChecklistGenerated(checklist);
    }
  }, [checklist, onChecklistGenerated]);

  const handleGenerate = async () => {
    await generate({
      assetType: assetType as any,
      taskType: taskType as any,
      customInstructions: customInstructions || undefined,
    });
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Generar Nuevo Checklist</h2>

      <div className="space-y-4">
        {/* Tipo de Activo */}
        <div>
          <label className="text-sm font-medium mb-2 block">Tipo de Activo</label>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Tarea */}
        <div>
          <label className="text-sm font-medium mb-2 block">Tipo de Mantenimiento</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Instrucciones Personalizadas */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Instrucciones Adicionales (Opcional)
          </label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Ej: Incluir verificaciones de temperatura, agregar pasos de seguridad específicos..."
            className="w-full rounded-md border px-3 py-2 min-h-[100px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {customInstructions.length}/500 caracteres
          </p>
        </div>

        {/* Botón de Generación */}
        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? 'Generando...' : 'Generar Checklist con IA'}
        </Button>

        {/* Mensaje de Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            <p className="font-medium">Error al generar checklist</p>
            <p className="mt-1">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
