'use client';

import { cn } from '@/app/lib/utils';

import { CommandPreview } from './command-preview';
import { CommandStatusIndicator } from './command-status-indicator';
import { useVoiceCommandFlow } from './hooks/use-voice-command-flow';
import { VoiceButton } from './voice-button';

/**
 * VoiceCommandModeProps - Props para el componente de modo comando de voz
 */
interface VoiceCommandModeProps {
  /** Callback when command execution completes successfully */
  onCommandExecuted?: (result: { resourceId?: string; message: string }) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Minimum confidence threshold (default: 0.7) */
  minConfidence?: number;
  /** Additional context to help parsing */
  context?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VoiceCommandMode - Flujo completo de comando de voz a Work Order
 *
 * Integra la entrada de voz con el parsing y ejecución de comandos:
 * - Usa VoiceButton para grabar
 * - Parsea la transcripción con executeVoiceCommand (via hook)
 * - Muestra CommandPreview para confirmación
 * - Ejecuta el comando usando WorkOrderService (via hook)
 * - Muestra estado de ejecución con CommandStatusIndicator
 *
 * Componente refactorizado para usar `useVoiceCommandFlow` y cumplir con reglas de tamaño (<200 líneas).
 * @param root0
 * @param root0.onCommandExecuted
 * @param root0.onError
 * @param root0.minConfidence
 * @param root0.context
 * @param root0.className
 */
export function VoiceCommandMode({
  onCommandExecuted,
  onError,
  minConfidence = 0.7,
  context,
  className,
}: VoiceCommandModeProps) {
  const {
    flowState,
    parsedCommand,
    parseError,
    execution,
    voiceInput,
    handleConfirm,
    handleCancel,
    handleRetry,
  } = useVoiceCommandFlow({
    onCommandExecuted,
    onError,
    minConfidence,
    context,
  });

  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = voiceInput;
  const {
    state: executionState,
    isExecuting,
    hasError: executionHasError,
    isSuccess: executionSuccess,
  } = execution;

  const displayError = parseError || voiceError;
  const showExecutionStatus = isExecuting || executionHasError || executionSuccess;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Voice button - always visible */}
      <div className="flex items-center gap-3">
        <VoiceButton
          isListening={isListening}
          isProcessing={isProcessing || flowState === 'processing'}
          isSupported={isSupported}
          mode={mode}
          onClick={toggleListening}
          disabled={flowState === 'confirming' || flowState === 'preview' || isExecuting}
        />

        {/* Status text for voice input */}
        {flowState === 'listening' && (
          <span className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
            Escuchando...
          </span>
        )}
        {flowState === 'processing' && (
          <span className="text-sm text-amber-600 dark:text-amber-400">Procesando comando...</span>
        )}
      </div>

      {/* Execution status indicator */}
      {showExecutionStatus && (
        <CommandStatusIndicator
          status={executionState.status}
          message={executionState.result?.message || executionState.error?.message}
          duration={executionState.duration}
          compact={false}
        />
      )}

      {/* Parse error message */}
      {displayError && flowState === 'idle' && !showExecutionStatus && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
          {displayError}
        </div>
      )}

      {/* Command preview */}
      {parsedCommand && (flowState === 'preview' || flowState === 'executing') && (
        <CommandPreview
          command={parsedCommand}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRetry={handleRetry}
          isConfirming={isExecuting}
        />
      )}
    </div>
  );
}
