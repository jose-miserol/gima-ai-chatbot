/**
 * Hook de Integración: useWorkOrderCommands
 *
 * Gestiona la ejecución de comandos de voz para Work Orders
 * con state machine, tracking de progreso y cancelación.
 *
 * @example
 * ```tsx
 * const { executeCommand, state, reset, cancel, isExecuting } = useWorkOrderCommands();
 *
 * // Ejecutar comando
 * const handleConfirm = async (command: VoiceWorkOrderCommand) => {
 *   const result = await executeCommand(command);
 *   if (result.success) {
 *     toast.success(result.message);
 *   }
 * };
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { getWorkOrderService } from '@/app/lib/services/work-order-service';
import type { WorkOrderExecutionResult } from '@/app/lib/services/contracts/work-order-service.contracts';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

// ============================================
// Types
// ============================================

/**
 * Estados posibles del comando
 */
export type CommandStatus =
  | 'idle' // Estado inicial, esperando comando
  | 'validating' // Validando input del comando
  | 'executing' // Ejecutando request al backend
  | 'retrying' // Re-intentando tras error recuperable
  | 'succeeded' // Ejecución exitosa
  | 'failed'; // Ejecución fallida

/**
 * Estado completo de la ejecución del comando
 */
export interface CommandState {
  /** Estado actual de la máquina de estados */
  status: CommandStatus;
  /** Resultado de la última ejecución (si existe) */
  result: WorkOrderExecutionResult | null;
  /** Error de la última ejecución (si existe) */
  error: Error | null;
  /** Timestamp de inicio de la ejecución actual */
  startedAt: number | null;
  /** Duración de la última ejecución en ms */
  duration: number | null;
  /** Número de intentos realizados */
  attemptCount: number;
}

/**
 * Valor de retorno del hook
 */
export interface UseWorkOrderCommandsReturn {
  /** Estado actual de la ejecución */
  state: CommandState;
  /** Ejecuta un comando de voz */
  executeCommand: (command: VoiceWorkOrderCommand) => Promise<WorkOrderExecutionResult>;
  /** Resetea el estado a idle */
  reset: () => void;
  /** Cancela la ejecución actual */
  cancel: () => void;
  /** Indica si se está ejecutando un comando */
  isExecuting: boolean;
  /** Indica si está en estado idle */
  isIdle: boolean;
  /** Indica si hubo error */
  hasError: boolean;
  /** Indica si la ejecución fue exitosa */
  isSuccess: boolean;
}

// ============================================
// Constants
// ============================================

const INITIAL_STATE: CommandState = {
  status: 'idle',
  result: null,
  error: null,
  startedAt: null,
  duration: null,
  attemptCount: 0,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Obtiene el userId del usuario actual
 * En producción esto vendría de la sesión/auth
 */
function getUserId(): string {
  // TODO: Integrar con sistema de autenticación real
  // Por ahora usamos un ID temporal basado en sessionStorage
  if (typeof window === 'undefined') return 'anonymous';

  let userId = sessionStorage.getItem('gima_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('gima_user_id', userId);
  }
  return userId;
}

/**
 * Genera un correlation ID único para tracing
 */
function generateCorrelationId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook para ejecutar comandos de voz de Work Orders
 *
 * Features:
 * - State machine con transiciones claras
 * - Tracking de duración y intentos
 * - Cancelación de ejecución
 * - Propiedades derivadas para UI
 */
export function useWorkOrderCommands(): UseWorkOrderCommandsReturn {
  const [state, setState] = useState<CommandState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Resetea el estado a idle
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * Cancela la ejecución actual
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'idle',
      error: new Error('Ejecución cancelada por el usuario'),
    }));
  }, []);

  /**
   * Ejecuta un comando de voz
   */
  const executeCommand = useCallback(
    async (command: VoiceWorkOrderCommand): Promise<WorkOrderExecutionResult> => {
      // Crear nuevo AbortController para esta ejecución
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();

      // Transición: idle → validating
      setState({
        status: 'validating',
        result: null,
        error: null,
        startedAt: startTime,
        duration: null,
        attemptCount: 0,
      });

      try {
        // Transición: validating → executing
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'executing',
            attemptCount: prev.attemptCount + 1,
          }));
        }

        // Obtener servicio y ejecutar
        const service = getWorkOrderService();
        const context = {
          userId: getUserId(),
          correlationId: generateCorrelationId(),
        };

        const result = await service.create(command, context);

        const duration = Date.now() - startTime;

        // Transición: executing → succeeded
        if (isMountedRef.current) {
          setState({
            status: 'succeeded',
            result,
            error: null,
            startedAt: startTime,
            duration,
            attemptCount: 1, // O el número real de intentos del service
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Transición: executing → failed
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: error as Error,
            duration,
          }));
        }

        // Re-throw para que el llamador pueda manejar
        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    []
  );

  // Propiedades derivadas
  const isExecuting =
    state.status === 'executing' || state.status === 'validating' || state.status === 'retrying';
  const isIdle = state.status === 'idle';
  const hasError = state.status === 'failed' && state.error !== null;
  const isSuccess = state.status === 'succeeded' && state.result !== null;

  return {
    state,
    executeCommand,
    reset,
    cancel,
    isExecuting,
    isIdle,
    hasError,
    isSuccess,
  };
}
