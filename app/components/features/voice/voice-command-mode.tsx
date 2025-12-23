'use client';

import { useState, useCallback } from 'react';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { executeVoiceCommand } from '@/app/actions';
import { VoiceButton } from './voice-button';
import { CommandPreview } from './command-preview';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';
import { cn } from '@/app/lib/utils';
import { logger } from '@/app/lib/logger';

/**
 * Voice command flow states
 */
type CommandFlowState = 'idle' | 'listening' | 'processing' | 'preview' | 'confirming';

/**
 * VoiceCommandModeProps - Props for the voice command mode component
 */
interface VoiceCommandModeProps {
  /** Callback when command is confirmed and ready for execution */
  onCommandConfirmed: (command: VoiceWorkOrderCommand) => void | Promise<void>;
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
 * VoiceCommandMode - Complete voice command input workflow
 *
 * Integrates voice input with command parsing and confirmation:
 * - Uses VoiceButton for recording
 * - Parses transcript with executeVoiceCommand
 * - Shows CommandPreview for confirmation
 * - Handles the full flow: idle → listening → processing → preview
 *
 * @example
 * ```tsx
 * <VoiceCommandMode
 *   onCommandConfirmed={(cmd) => createWorkOrder(cmd)}
 *   onError={(err) => showToast(err)}
 *   minConfidence={0.75}
 * />
 * ```
 */
export function VoiceCommandMode({
  onCommandConfirmed,
  onError,
  minConfidence = 0.7,
  context,
  className,
}: VoiceCommandModeProps) {
  const [flowState, setFlowState] = useState<CommandFlowState>('idle');
  const [parsedCommand, setParsedCommand] = useState<VoiceWorkOrderCommand | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

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
      } else if (state === 'idle' && flowState === 'listening') {
        // Voice stopped without processing - stay idle
        setFlowState('idle');
      }
    },
    [flowState]
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

  const handleConfirm = useCallback(async () => {
    if (!parsedCommand) return;

    setFlowState('confirming');
    try {
      await onCommandConfirmed(parsedCommand);
      setParsedCommand(null);
      setFlowState('idle');
      logger.info('Voice command confirmed', {
        component: 'VoiceCommandMode',
        action: parsedCommand.action,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al ejecutar comando';
      setParseError(errorMsg);
      setFlowState('preview');
      onError?.(errorMsg);
    }
  }, [parsedCommand, onCommandConfirmed, onError]);

  const handleCancel = useCallback(() => {
    setParsedCommand(null);
    setParseError(null);
    setFlowState('idle');
  }, []);

  const handleRetry = useCallback(() => {
    setParsedCommand(null);
    setParseError(null);
    setFlowState('idle');
    // Start recording again after a brief delay
    setTimeout(() => {
      toggleListening();
    }, 100);
  }, [toggleListening]);

  const displayError = parseError || voiceError;

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
          disabled={flowState === 'confirming' || flowState === 'preview'}
        />

        {/* Status text */}
        {flowState === 'listening' && (
          <span className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
            Escuchando...
          </span>
        )}
        {flowState === 'processing' && (
          <span className="text-sm text-amber-600 dark:text-amber-400">Procesando comando...</span>
        )}
      </div>

      {/* Error message */}
      {displayError && flowState === 'idle' && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
          {displayError}
        </div>
      )}

      {/* Command preview */}
      {parsedCommand && (flowState === 'preview' || flowState === 'confirming') && (
        <CommandPreview
          command={parsedCommand}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRetry={handleRetry}
          isConfirming={flowState === 'confirming'}
        />
      )}
    </div>
  );
}
