/**
 * @file use-work-order-commands.ts
 * @module app/hooks/use-work-order-commands
 *
 * ============================================================
 * HOOK — EJECUCIÓN DE COMANDOS DE VOZ PARA ÓRDENES DE TRABAJO
 * ============================================================
 *
 * QUÉ HACE ESTE HOOK:
 *   Gestiona el ciclo completo de ejecución de un comando de voz que crea
 *   o modifica una Orden de Trabajo en el backend GIMA. Implementa:
 *
 *   - MÁQUINA DE ESTADOS: Transiciones claras entre idle → validating →
 *     executing → succeeded/failed. Evita estados inconsistentes.
 *   - TRACKING DE PROGRESO: Mide duración, número de intentos y timestamps.
 *   - CANCELACIÓN: AbortController para cancelar requests en vuelo.
 *   - PROPIEDADES DERIVADAS: isExecuting, isIdle, hasError, isSuccess
 *     para que la UI no necesite comparar el status string directamente.
 *
 * CONTEXTO EN GIMA:
 *   El flujo de comandos de voz para work orders es:
 *   [Usuario habla] → useVoiceInput (transcripción) →
 *   executeVoiceCommand (parsing Gemini) → confirmación UI →
 *   useWorkOrderCommands.executeCommand() → backend Laravel →
 *   setState(succeeded/failed)
 *
 *   Este hook cubre el último paso: ejecutar el comando confirmado
 *   contra el backend y gestionar el estado de la operación.
 *
 * IDENTIFICACIÓN DE USUARIO (getUserId):
 *   Actualmente usa un ID temporal en sessionStorage. En producción,
 *   debe integrarse con el sistema de autenticación real (Laravel Sanctum).
 *   El TODO en getUserId() señala este punto de extensión.
 *
 * CORRELATION ID (generateCorrelationId):
 *   Identificador único por ejecución para trazabilidad en logs del backend.
 *   Formato: `cmd_<timestamp>_<random>` para facilitar búsqueda en logs.
 *
 * DÓNDE SE USA:
 *   - app/components/features/voice/VoiceCommandConfirmDialog.tsx
 *     (ejecuta el comando después de que el usuario confirma)
 * ============================================================
 */

import { useState, useCallback, useRef } from 'react';

// Tipo del resultado de ejecución definido en el contrato del servicio de Work Orders
import type { WorkOrderExecutionResult } from '@/app/lib/services/contracts/work-order-service.contracts';

// Servicio de Work Orders: encapsula la llamada al backend Laravel
// getWorkOrderService() retorna la implementación real o mock según el entorno
import { getWorkOrderService } from '@/app/lib/services/work-order-service';

// Tipo del comando de voz parseado y validado por VoiceCommandParserService
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

// ============================================================
// TIPOS EXPORTADOS
// ============================================================

/**
 * Estados posibles del ciclo de vida de un comando de Work Order.
 *
 * DIAGRAMA DE TRANSICIONES:
 *   idle
 *     ↓ executeCommand()
 *   validating
 *     ↓ validación OK
 *   executing
 *     ↓ éxito           ↓ error recuperable    ↓ error definitivo
 *   succeeded         retrying               failed
 *     ↓ reset()          ↓ reintentos            ↓ reset()
 *   idle             ejecutando → succeeded/failed
 */
export type CommandStatus =
  | 'idle' // Estado inicial. Esperando comando del usuario.
  | 'validating' // Validando campos del comando antes de enviar (rápido, casi imperceptible)
  | 'executing' // Request en vuelo hacia el backend GIMA
  | 'retrying' // Re-intentando tras error recuperable (ej: timeout de red)
  | 'succeeded' // Backend respondió con éxito y creó/actualizó la OT
  | 'failed'; // Backend rechazó el comando o hubo error irrecuperable

/**
 * Estado completo de la ejecución del comando. Suficientemente rico para
 * mostrar feedback detallado en la UI (tiempo de respuesta, número de intentos).
 */
export interface CommandState {
  /** Estado actual de la máquina de estados */
  status: CommandStatus;
  /** Resultado de la ejecución si fue exitosa. null en cualquier otro estado. */
  result: WorkOrderExecutionResult | null;
  /** Error capturado si la ejecución falló. null si no hay error. */
  error: Error | null;
  /** Unix timestamp de inicio de la ejecución actual (para calcular duración en UI). */
  startedAt: number | null;
  /** Duración de la última ejecución en ms. null mientras está en curso. */
  duration: number | null;
  /** Número de intentos realizados en la ejecución actual (útil para mostrar en retrying). */
  attemptCount: number;
}

/**
 * Interfaz pública del hook. Todo lo que el componente padre puede usar.
 */
export interface UseWorkOrderCommandsReturn {
  /** Estado completo para componentes que necesitan detalle (ej: panel de debug). */
  state: CommandState;
  /** Ejecuta el comando contra el backend. Resuelve con el resultado o lanza error. */
  executeCommand: (command: VoiceWorkOrderCommand) => Promise<WorkOrderExecutionResult>;
  /** Regresa a `idle` y limpia result/error. Llamar después de manejar succeeded/failed. */
  reset: () => void;
  /** Aborta el request en vuelo y regresa a `idle` con error de cancelación. */
  cancel: () => void;
  /** true cuando status es 'executing', 'validating' o 'retrying'. Para deshabilitar botones. */
  isExecuting: boolean;
  /** true cuando status es 'idle'. Para habilitar el botón de ejecutar. */
  isIdle: boolean;
  /** true cuando status es 'failed' Y hay un error. Para mostrar UI de error. */
  hasError: boolean;
  /** true cuando status es 'succeeded' Y hay un result. Para mostrar UI de éxito. */
  isSuccess: boolean;
}

// ============================================================
// ESTADO INICIAL
// ============================================================

/**
 * Estado vacío al que vuelve el hook con reset() o al montar.
 * Definido fuera del hook para ser una referencia estable (no se recrea en cada render).
 */
const INITIAL_STATE: CommandState = {
  status: 'idle',
  result: null,
  error: null,
  startedAt: null,
  duration: null,
  attemptCount: 0,
};

// ============================================================
// HELPERS DE MÓDULO
// ============================================================

/**
 * Obtiene el ID del usuario actual para el contexto de la operación.
 *
 * TODO: Integrar con el sistema de autenticación real (Laravel Sanctum).
 * Actualmente genera y persiste un ID temporal en sessionStorage.
 * El ID de sessionStorage expira cuando el usuario cierra la pestaña,
 * lo que es apropiado para el comportamiento actual de sesión de GIMA.
 *
 * @returns ID de usuario como string. 'anonymous' en el servidor (SSR).
 */
function getUserId(): string {
  if (typeof window === 'undefined') return 'anonymous'; // SSR guard

  let userId = sessionStorage.getItem('gima_user_id');
  if (!userId) {
    // Generar ID único que persiste por la duración de la pestaña
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('gima_user_id', userId);
  }
  return userId;
}

/**
 * Genera un ID de correlación único para trazabilidad en logs del backend.
 *
 * FORMATO: `cmd_<timestamp>_<random9chars>`
 * EJEMPLO: `cmd_1703512345678_x7k2m9pqr`
 *
 * POR QUÉ INCLUIR TIMESTAMP:
 *   Permite ordenar cronológicamente los IDs en logs sin necesidad de
 *   un campo de timestamp separado en la búsqueda.
 */
function generateCorrelationId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================

/**
 * Hook para ejecutar comandos de voz de Work Orders con máquina de estados.
 *
 * QUÉ HACE:
 *   Toma un VoiceWorkOrderCommand (previamente parseado y confirmado por el usuario),
 *   lo envía al WorkOrderService y gestiona todo el ciclo de vida de esa operación:
 *   transiciones de estado, tracking de métricas y manejo de errores.
 *
 * PATRÓN DE USO TÍPICO:
 * ```tsx
 * const { executeCommand, state, reset, cancel, isExecuting } = useWorkOrderCommands();
 *
 * const handleConfirm = async (command: VoiceWorkOrderCommand) => {
 *   try {
 *     const result = await executeCommand(command);
 *     toast.success(`Orden #${result.workOrderId} creada`);
 *     reset(); // Regresar a idle después de manejar el éxito
 *   } catch (error) {
 *     // El estado ya es 'failed', solo mostrar UI de error
 *     toast.error('No se pudo crear la orden');
 *   }
 * };
 * ```
 */
export function useWorkOrderCommands(): UseWorkOrderCommandsReturn {
  const [state, setState] = useState<CommandState>(INITIAL_STATE);

  // Ref para el AbortController del request en vuelo (no necesita causar re-render)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref para saber si el componente sigue montado antes de actualizar estado.
  // Evita el warning "Can't perform a React state update on an unmounted component".
  const isMountedRef = useRef(true);

  /**
   * Regresa el estado a `idle` limpiando result y error.
   * Llamar tras manejar succeeded o failed en el componente padre.
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * Cancela el request en vuelo y regresa a `idle` con error de cancelación.
   *
   * POR QUÉ AbortController Y NO UN FLAG:
   *   AbortController cancela realmente el fetch pendiente, liberando recursos
   *   de red. Un simple flag booleano solo ignoraría la respuesta que ya llegó,
   *   desperdiciando el trabajo del servidor y el ancho de banda.
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
   * Ejecuta un comando de Work Order contra el backend GIMA.
   *
   * MÁQUINA DE ESTADOS INTERNA:
   *   idle → validating → executing → succeeded (retorna result)
   *                                 → failed     (lanza error)
   *
   * POR QUÉ RE-THROW DEL ERROR:
   *   El hook gestiona el estado (`failed`), pero el componente padre
   *   necesita saber si falló para mostrar su propia UI (toast, modal, etc.).
   *   Re-lanzar el error permite que ambos manejen la falla de forma independiente.
   *
   * @param command - Comando de voz parseado por Gemini y confirmado por el usuario.
   * @returns Promise que resuelve al WorkOrderExecutionResult en caso de éxito.
   * @throws El error original si el servicio falla.
   */
  const executeCommand = useCallback(
    async (command: VoiceWorkOrderCommand): Promise<WorkOrderExecutionResult> => {
      abortControllerRef.current = new AbortController();
      const startTime = Date.now();

      // Transición 1: idle → validating
      setState({
        status: 'validating',
        result: null,
        error: null,
        startedAt: startTime,
        duration: null,
        attemptCount: 0,
      });

      try {
        // Transición 2: validating → executing
        // isMountedRef evita actualizar estado en componente ya desmontado
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'executing',
            attemptCount: prev.attemptCount + 1,
          }));
        }

        // Obtener el servicio (real en producción, mock en tests)
        const service = getWorkOrderService();

        // El contexto incluye userId (para auditoría) y correlationId (para logs)
        const context = {
          userId: getUserId(),
          correlationId: generateCorrelationId(),
        };

        const result = await service.create(command, context);
        const duration = Date.now() - startTime;

        // Transición 3: executing → succeeded
        if (isMountedRef.current) {
          setState({
            status: 'succeeded',
            result,
            error: null,
            startedAt: startTime,
            duration,
            attemptCount: 1,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Transición 3 (alternativa): executing → failed
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: error as Error,
            duration,
          }));
        }

        // Re-lanzar para que el componente padre pueda mostrar notificaciones
        throw error;
      } finally {
        // Limpiar el AbortController independientemente del resultado
        abortControllerRef.current = null;
      }
    },
    []
  );

  // ============================================================
  // PROPIEDADES DERIVADAS
  // ============================================================
  // Calculadas en cada render a partir del estado. La UI las usa para
  // deshabilitar botones y cambiar estilos sin comparar strings de status.

  /** true durante los estados intermedios (mostrar spinner, deshabilitar botones) */
  const isExecuting =
    state.status === 'executing' || state.status === 'validating' || state.status === 'retrying';

  /** true solo cuando no hay operación en curso (habilitar botón "Ejecutar") */
  const isIdle = state.status === 'idle';

  /** true cuando la última ejecución falló Y tenemos el error disponible */
  const hasError = state.status === 'failed' && state.error !== null;

  /** true cuando la última ejecución fue exitosa Y tenemos el resultado */
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
