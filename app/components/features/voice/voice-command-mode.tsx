'use client';

import { useState, useCallback } from 'react';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { useWorkOrderCommands } from '@/app/hooks/use-work-order-commands';
import { executeVoiceCommand } from '@/app/actions';
import { VoiceButton } from './voice-button';
import { CommandPreview } from './command-preview';
import { CommandStatusIndicator } from './command-status-indicator';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';
import { cn } from '@/app/lib/utils';
import { logger } from '@/app/lib/logger';

/**
 * Estados del flujo de comando de voz
 */
type CommandFlowState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'preview'
  | 'confirming'
  | 'executing';

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
 * - Parsea la transcripción con executeVoiceCommand
 * - Muestra CommandPreview para confirmación
 * - Ejecuta el comando usando WorkOrderService
 * - Muestra estado de ejecución con CommandStatusIndicator
 *
 * @example
 * ```tsx
 * <VoiceCommandMode
 *   onCommandExecuted={(result) => toast.success(result.message)}
 *   onError={(err) => toast.error(err)}
 *   minConfidence={0.75}
 * />
 * ```
 */
export function VoiceCommandMode({
  onCommandExecuted,
  onError,
  minConfidence = 0.7,
  context,
  className,
}: VoiceCommandModeProps) {
  const [flowState, setFlowState] = useState<CommandFlowState>('idle');
  const [parsedCommand, setParsedCommand] = useState<VoiceWorkOrderCommand | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Hook de ejecución de Work Orders
  const {
    state: executionState,
    executeCommand,
    reset: resetExecution,
    isExecuting,
    hasError: executionHasError,
    isSuccess: executionSuccess,
  } = useWorkOrderCommands();

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setFlowState('processing');
      setParseError(null);

      try {
        const result = await executeVoiceCommand(transcript, {
          minConfidence,
          context,
        });

        if (result.success) {
          setParsedCommand(result.command as VoiceWorkOrderCommand);
          setFlowState('preview');
          logger.info('Voice command parsed successfully', {
            component: 'VoiceCommandMode',
            action: result.command.action,
            confidence: result.command.confidence,
          });
        } else {
          setParseError(result.error);
          setFlowState('idle');
          onError?.(result.error);
          logger.warn('Voice command parsing failed', {
            component: 'VoiceCommandMode',
            error: result.error,
            code: result.code,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        setParseError(errorMsg);
        setFlowState('idle');
        onError?.(errorMsg);
        logger.error(
          'Voice command execution error',
          err instanceof Error ? err : new Error(errorMsg),
          {
            component: 'VoiceCommandMode',
          }
        );
      }
    },
    [minConfidence, context, onError]
  );

  const handleStateChange = useCallback(
    (state: 'listening' | 'processing' | 'idle') => {
      if (state === 'listening') {
        setFlowState('listening');
        setParsedCommand(null);
        setParseError(null);
        resetExecution(); // Reset estado de ejecución anterior
      } else if (state === 'idle' && flowState === 'listening') {
        setFlowState('idle');
      }
    },
    [flowState, resetExecution]
  );

  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: handleTranscript,
    onError: onError,
    onStateChange: handleStateChange,
    language: 'es-ES',
  });

  /**
   * Confirmar y ejecutar el comando al backend
   */
  const handleConfirm = useCallback(async () => {
    if (!parsedCommand) return;

    setFlowState('executing');

    try {
      const result = await executeCommand(parsedCommand);

      logger.info('Work order created successfully', {
        component: 'VoiceCommandMode',
        resourceId: result.resourceId,
        action: parsedCommand.action,
      });

      // Notificar éxito
      onCommandExecuted?.({
        resourceId: result.resourceId,
        message: result.message,
      });

      // Limpiar estado después del éxito
      setTimeout(() => {
        setParsedCommand(null);
        setFlowState('idle');
        resetExecution();
      }, 2000); // Mostrar éxito por 2 segundos
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al ejecutar comando';
      setParseError(errorMsg);
      setFlowState('preview'); // Volver a preview para reintentar
      onError?.(errorMsg);
      logger.error('Work order creation failed', err instanceof Error ? err : new Error(errorMsg), {
        component: 'VoiceCommandMode',
        action: parsedCommand.action,
      });
    }
  }, [parsedCommand, executeCommand, onCommandExecuted, onError, resetExecution]);

  const handleCancel = useCallback(() => {
    setParsedCommand(null);
    setParseError(null);
    setFlowState('idle');
    resetExecution();
  }, [resetExecution]);

  const handleRetry = useCallback(() => {
    setParsedCommand(null);
    setParseError(null);
    setFlowState('idle');
    resetExecution();
    // Start recording again after a brief delay
    setTimeout(() => {
      toggleListening();
    }, 100);
  }, [toggleListening, resetExecution]);

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
