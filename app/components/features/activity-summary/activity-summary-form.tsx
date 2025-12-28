/**
 * ActivitySummaryForm - Formulario de generación
 *
 * Formulario para solicitar generación de resumen con IA.
 * Permite ingresar actividades, seleccionar estilo y nivel de detalle.
 */

'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/app/components/ui/button';
import { ASSET_TYPES, TASK_TYPES } from '@/app/constants/ai';

import { SUMMARY_STYLES, DETAIL_LEVELS, SUMMARY_LIMITS } from './constants';
import { useSummaryGenerator } from './hooks';

import type { ActivitySummary } from './types';

interface ActivitySummaryFormProps {
  /**
   * Callback cuando se genera un resumen exitosamente
   */
  onSummaryGenerated: (summary: ActivitySummary) => void;
}

/**
 *
 * @param root0
 * @param root0.onSummaryGenerated
 */
export function ActivitySummaryForm({ onSummaryGenerated }: ActivitySummaryFormProps) {
  const [assetType, setAssetType] = useState<string>(ASSET_TYPES[0]);
  const [taskType, setTaskType] = useState<string>(TASK_TYPES[0]);
  const [activities, setActivities] = useState('');
  const [style, setStyle] = useState<string>(SUMMARY_STYLES[0]);
  const [detailLevel, setDetailLevel] = useState<string>(DETAIL_LEVELS[1]); // medio por defecto

  const { isGenerating, summary, error, generate } = useSummaryGenerator();

  const activitiesLength = activities.length;
  const isValidLength =
    activitiesLength >= SUMMARY_LIMITS.MIN_ACTIVITIES_LENGTH &&
    activitiesLength <= SUMMARY_LIMITS.MAX_ACTIVITIES_LENGTH;

  // Notificar cuando se genera un resumen
  useEffect(() => {
    if (summary) {
      onSummaryGenerated(summary);
    }
  }, [summary, onSummaryGenerated]);

  const handleGenerate = async () => {
    if (!isValidLength) return;

    await generate({
      assetType: assetType as any,
      taskType: taskType as any,
      activities,
      style: style as any,
      detailLevel: detailLevel as any,
    });
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Generar Resumen de Actividades</h2>

      <div className="space-y-4">
        {/* Tipo de Activo y Tarea */}
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* Actividades Realizadas */}
        <div>
          <label className="text-sm font-medium mb-2 block">Actividades Realizadas *</label>
          <textarea
            value={activities}
            onChange={(e) => setActivities(e.target.value)}
            placeholder="Describe las actividades de mantenimiento realizadas..."
            className="w-full rounded-md border px-3 py-2 min-h-[150px]"
            maxLength={SUMMARY_LIMITS.MAX_ACTIVITIES_LENGTH}
          />
          <div className="flex justify-between items-center mt-1">
            <p
              className={`text-xs ${!isValidLength && activitiesLength > 0 ? 'text-red-600' : 'text-muted-foreground'
                }`}
            >
              {activitiesLength}/{SUMMARY_LIMITS.MAX_ACTIVITIES_LENGTH} caracteres
              {activitiesLength > 0 && activitiesLength < SUMMARY_LIMITS.MIN_ACTIVITIES_LENGTH && (
                <span className="ml-2">(mínimo {SUMMARY_LIMITS.MIN_ACTIVITIES_LENGTH})</span>
              )}
            </p>
          </div>
        </div>

        {/* Estilo y Nivel de Detalle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Estilo</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              {SUMMARY_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Nivel de Detalle</label>
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              {DETAIL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón de Generación */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !isValidLength}
          className="w-full"
        >
          {isGenerating ? 'Generando resumen...' : 'Generar Resumen con IA'}
        </Button>

        {/* Mensaje de Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            <p className="font-medium">Error al generar resumen</p>
            <p className="mt-1">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
