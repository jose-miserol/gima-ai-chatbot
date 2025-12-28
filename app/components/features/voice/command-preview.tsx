'use client';

import {
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Package,
  MapPin,
  Users,
} from 'lucide-react';

import { cn } from '@/app/lib/utils';
import type { VoiceCommand } from '@/app/types/voice-commands';
import { formatCommandSummary, requiresConfirmation } from '@/app/types/voice-commands';

/**
 * CommandPreviewProps - Props para el componente de vista previa de comandos
 */
interface CommandPreviewProps {
  /** Parsed voice command to display */
  command: VoiceCommand;
  /** Callback when user confirms the command */
  onConfirm: () => void;
  /** Callback when user cancels the command */
  onCancel: () => void;
  /** Callback when user wants to re-record */
  onRetry: () => void;
  /** Whether confirmation is in progress */
  isConfirming?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CommandPreview - Muestra el comando de voz parseado para confirmación del usuario
 *
 * Muestra el comando interpretado con campos extraídos:
 * - Tipo de acción con icono
 * - Equipo, ubicación, prioridad si están presentes
 * - Indicador de confianza
 * - Botones de Confirmar/Cancelar/Reintentar
 * @param root0
 * @param root0.command
 * @param root0.onConfirm
 * @param root0.onCancel
 * @param root0.onRetry
 * @param root0.isConfirming
 * @param root0.className
 * @example
 * ```tsx
 * <CommandPreview
 *   command={parsedCommand}
 *   onConfirm={() => executeCommand()}
 *   onCancel={() => clearCommand()}
 *   onRetry={() => startRecording()}
 * />
 * ```
 */
export function CommandPreview({
  command,
  onConfirm,
  onCancel,
  onRetry,
  isConfirming = false,
  className,
}: CommandPreviewProps) {
  const needsConfirmation = requiresConfirmation(command);
  const confidencePercent = Math.round(command.confidence * 100);

  const getConfidenceColor = () => {
    if (confidencePercent >= 90) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (confidencePercent >= 75) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const getPriorityBadge = () => {
    if (command.type !== 'work_order' || !command.priority) return null;
    const colors = {
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', colors[command.priority])}>
        {command.priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* Header with summary */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
          {formatCommandSummary(command)}
        </h3>
        {getPriorityBadge()}
      </div>

      {/* Extracted fields */}
      <div className="space-y-2 mb-4">
        {command.type === 'work_order' && (
          <>
            {command.equipment && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Package className="size-4" />
                <span>Equipo: {command.equipment}</span>
              </div>
            )}
            {command.location && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <MapPin className="size-4" />
                <span>Ubicación: {command.location}</span>
              </div>
            )}
            {command.assignee && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Users className="size-4" />
                <span>Asignar a: {command.assignee}</span>
              </div>
            )}
            {command.description && (
              <div className="text-sm text-zinc-600 dark:text-zinc-400 italic">
                &ldquo;{command.description}&rdquo;
              </div>
            )}
          </>
        )}

        {command.type === 'navigation' && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Ruta:{' '}
            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
              {command.path || command.screen}
            </span>
          </div>
        )}
      </div>

      {/* Confidence indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('px-2 py-1 rounded text-xs font-medium', getConfidenceColor())}>
          {confidencePercent}% confianza
        </span>
        {needsConfirmation && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            Requiere confirmación
          </span>
        )}
      </div>

      {/* Original transcript */}
      <div className="mb-4 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">Transcripción:</span> {command.rawTranscript}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <CheckCircle className="size-4" />
          {isConfirming ? 'Confirmando...' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={isConfirming}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          )}
        >
          <RotateCcw className="size-4" />
          Reintentar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
        >
          <XCircle className="size-4" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
