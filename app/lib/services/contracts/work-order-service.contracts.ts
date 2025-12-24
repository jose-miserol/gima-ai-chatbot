/**
 * Contratos del Servicio de Órdenes de Trabajo
 *
 * Define interfaces, tipos y errores personalizados para el
 * WorkOrderService. Permite inyección completa de dependencias
 * para testing y provee error handling tipado.
 *
 * @example
 * ```typescript
 * import type {
 *   WorkOrderServiceConfig,
 *   WorkOrderServiceDeps,
 *   RequestContext,
 * } from './work-order-service.contracts';
 *
 * const service = new WorkOrderService(config, deps);
 * const result = await service.create(command, context);
 * ```
 */

/**
 * Interfaz del Logger para inyección de dependencias
 * Compatible con app/lib/logger.ts
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/**
 * Configuración del servicio de Work Orders
 * Permite inyección completa de dependencias para testing
 */
export interface WorkOrderServiceConfig {
  /** URL base del API backend */
  baseUrl: string;
  /** Clave API para autenticación */
  apiKey: string;
  /** Timeout en milisegundos por request */
  timeoutMs: number;
  /** Número máximo de reintentos */
  maxRetries: number;
}

/**
 * Abstracción de timers para testing
 * Permite control completo en tests con fake timers
 * Tipos simplificados para compatibilidad Node.js/Browser
 */
export interface TimerImpl {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

/**
 * Contexto de abort para un request
 */
export interface AbortContext {
  controller: AbortController;
  timeoutId: unknown;
  abort: () => void;
}

/**
 * Factory para crear AbortController testeables
 * Permite simular timeouts sin depender del event loop real
 */
export interface AbortControllerFactory {
  create: () => AbortContext;
}

/**
 * Dependencias inyectables - reemplazan globals en tests
 */
export interface WorkOrderServiceDeps {
  /** Implementación de fetch inyectable */
  fetchImpl: typeof fetch;
  /** Logger para observabilidad */
  loggerImpl: Logger;
  /** Crypto para generación de UUIDs */
  cryptoImpl: Pick<Crypto, 'randomUUID'>;
  /** Reloj inyectable para time-travel testing */
  clockImpl?: { now: () => number };
  /** Timers inyectables para control de delays */
  timerImpl?: TimerImpl;
  /** Factory de AbortController para control de timeouts */
  abortFactory?: AbortControllerFactory;
}

/**
 * Contexto de request para observabilidad
 */
export interface RequestContext {
  /** Usuario que ejecuta la acción */
  userId: string;
  /** ID para tracing distribuido */
  correlationId: string;
  /** Sesión actual (opcional) */
  sessionId?: string;
}

/**
 * Resultado estándar de ejecución de comandos
 * Compatible con tipos existentes en voice-commands.ts
 */
export interface WorkOrderExecutionResult {
  /** Indica si la operación fue exitosa */
  success: boolean;
  /** Mensaje descriptivo del resultado */
  message: string;
  /** ID del recurso creado/modificado */
  resourceId?: string;
  /** URL para navegación al recurso */
  resourceUrl?: string;
  /** Metadata adicional del resultado */
  metadata?: {
    /** Duración de la operación en ms (opcional) */
    duration?: number;
    /** Número de reintentos realizados */
    retryCount?: number;
    /** Datos adicionales del backend */
    [key: string]: unknown;
  };
  /** Información de error (solo si success = false) */
  error?: {
    /** Código de error estandarizado */
    code: ErrorCode;
    /** Mensaje de error legible */
    message: string;
    /** Si el error es recuperable con retry */
    recoverable: boolean;
    /** Segundos para retry en caso de rate limit */
    retryAfter?: number;
  };
}

/**
 * Códigos de error estandarizados
 * Mapean a HTTP status codes y facilitan manejo en UI
 */
export type ErrorCode =
  | 'VALIDATION_ERROR' // 400 - Datos de entrada inválidos
  | 'NETWORK_ERROR' // Error de conectividad
  | 'TIMEOUT' // Request excedió tiempo límite
  | 'RATE_LIMITED' // 429 - Límite de requests alcanzado
  | 'UNAUTHORIZED' // 401 - Autenticación requerida
  | 'FORBIDDEN' // 403 - Sin permisos suficientes
  | 'NOT_FOUND' // 404 - Recurso no encontrado
  | 'SERVICE_UNAVAILABLE' // 503 - Servicio no disponible
  | 'INTERNAL_ERROR'; // 500+ - Error interno del servidor

/**
 * Error base para operaciones de Work Order
 * Provee contexto estructurado para logging y debugging
 */
export class WorkOrderError extends Error {
  constructor(
    message: string,
    /** Código de error estandarizado */
    public code: ErrorCode,
    /** Si el error puede recuperarse con retry */
    public recoverable: boolean,
    /** Status HTTP original (si aplica) */
    public statusCode?: number,
    /** ID de correlación para tracing */
    public correlationId?: string
  ) {
    super(message);
    this.name = 'WorkOrderError';
    // Mantener stack trace correcto en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WorkOrderError);
    }
  }
}

/**
 * Error de límite de rate alcanzado (HTTP 429)
 * Incluye tiempo de espera recomendado
 */
export class RateLimitError extends WorkOrderError {
  constructor(
    message: string,
    /** Segundos a esperar antes de reintentar */
    public retryAfter: number
  ) {
    super(message, 'RATE_LIMITED', true, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Error de timeout de request
 * Ocurre cuando el request excede timeoutMs
 */
export class TimeoutError extends WorkOrderError {
  constructor(message: string) {
    super(message, 'TIMEOUT', true);
    this.name = 'TimeoutError';
  }
}

/**
 * Error de servicio no disponible (HTTP 503)
 * Indica mantenimiento o sobrecarga temporal
 */
export class ServiceUnavailableError extends WorkOrderError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE', true, 503);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error de validación de entrada (HTTP 400)
 * Datos del request no cumplen con schema
 */
export class ValidationError extends WorkOrderError {
  constructor(
    message: string,
    /** Errores de validación específicos por campo */
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message, 'VALIDATION_ERROR', false, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Error de red genérico
 * Problemas de conectividad, DNS, etc.
 */
export class NetworkError extends WorkOrderError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
  }
}
