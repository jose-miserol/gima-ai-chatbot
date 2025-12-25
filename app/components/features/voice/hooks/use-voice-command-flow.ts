'use client';

import { useState, useCallback, useEffect } from 'react';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { useWorkOrderCommands } from '@/app/hooks/use-work-order-commands';
import { useVoiceNavigation } from './use-voice-navigation';
import { useVoiceSystem } from './use-voice-system';
import { executeVoiceCommand } from '@/app/actions';
import type {
  VoiceCommand,
  VoiceWorkOrderCommand,
  VoiceNavigationCommand,
  VoiceSystemCommand,
} from '@/app/types/voice-commands';
import { logger } from '@/app/lib/logger';

export type CommandFlowState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'preview'
  | 'confirming'
  | 'executing';

interface UseVoiceCommandFlowProps {
  onCommandExecuted?: (result: { resourceId?: string; message: string }) => void;
  onError?: (error: string) => void;
  minConfidence?: number;
  context?: string;
}

export function useVoiceCommandFlow({
  onCommandExecuted,
  onError,
  minConfidence = 0.7,
  context,
}: UseVoiceCommandFlowProps) {
  const [flowState, setFlowState] = useState<CommandFlowState>('idle');
  const [parsedCommand, setParsedCommand] = useState<VoiceCommand | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Hook de ejecución de Work Orders
  const execution = useWorkOrderCommands();
  const { executeCommand, reset: resetExecution } = execution;

  // Hooks de Navegación y Sistema
  const { navigate } = useVoiceNavigation();
  const { executeSystem } = useVoiceSystem();

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setFlowState('processing');
      setParseError(null);

      try {
        const result = await executeVoiceCommand(transcript, {
          minConfidence,
          context,
        });

        if (result.success && result.command) {
          setParsedCommand(result.command);
          setFlowState('preview');
          logger.info('Voice command parsed successfully', {
            component: 'useVoiceCommandFlow',
            action: result.command.action,
            confidence: result.command.confidence,
          });
        } else {
          setParseError(result.error);
          setFlowState('idle');
          onError?.(result.error);
          logger.warn('Voice command parsing failed', {
            component: 'useVoiceCommandFlow',
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
            component: 'useVoiceCommandFlow',
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

  const voiceInput = useVoiceInput({
    onTranscript: handleTranscript,
    onError: onError,
    onStateChange: handleStateChange,
    language: 'es-ES',
  });

  const handleConfirm = useCallback(async () => {
    if (!parsedCommand) return;

    // Navegación
    if (parsedCommand.type === 'navigation') {
      const result = navigate(parsedCommand as VoiceNavigationCommand);
      if (result.success) {
        onCommandExecuted?.({
          resourceId: 'nav-' + Date.now(),
          message: result.message,
        });
        setParsedCommand(null);
        setFlowState('idle');
      } else {
        setParseError(result.message);
        // Mantener estado en preview para reintentar o cancelar
      }
      return;
    }

    // Comandos de Sistema
    if (parsedCommand.type === 'system') {
      const result = executeSystem(parsedCommand as VoiceSystemCommand);
      if (result.success) {
        onCommandExecuted?.({
          resourceId: 'sys-' + Date.now(),
          message: result.message,
        });
        setParsedCommand(null);
        setFlowState('idle');
      } else {
        setParseError(result.message);
      }
      return;
    }

    // Work Orders (Legacy Logic)
    if (parsedCommand.type === 'work_order') {
      setFlowState('executing');

      try {
        const result = await executeCommand(parsedCommand as VoiceWorkOrderCommand);

        logger.info('Work order created successfully', {
          component: 'useVoiceCommandFlow',
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
        }, 2000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al ejecutar comando';
        setParseError(errorMsg);
        setFlowState('preview');
        onError?.(errorMsg);
        logger.error(
          'Work order creation failed',
          err instanceof Error ? err : new Error(errorMsg),
          {
            component: 'useVoiceCommandFlow',
            action: parsedCommand.action,
          }
        );
      }
    }
  }, [
    parsedCommand,
    executeCommand,
    onCommandExecuted,
    onError,
    resetExecution,
    navigate,
    executeSystem,
  ]);

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
      voiceInput.toggleListening();
    }, 100);
  }, [voiceInput, resetExecution]);

  // Auto-cancel after 30 seconds of inactivity in preview
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (flowState === 'preview' && parsedCommand) {
      timer = setTimeout(() => {
        logger.info('Voice command timed out', { action: parsedCommand.action });
        handleCancel();
      }, 30000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [flowState, parsedCommand, handleCancel]);

  return {
    flowState,
    parsedCommand,
    parseError,
    execution,
    voiceInput,
    handleConfirm,
    handleCancel,
    handleRetry,
  };
}
