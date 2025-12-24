/**
 * Servicio de Órdenes de Trabajo
 *
 * Cliente HTTP para el API REST de Work Orders del backend.
 * Implementa inyección de dependencias completa para testing,
 * retry logic con backoff exponencial, y error handling tipado.
 *
 * @example
 * ```typescript
 * import { workOrderService } from '@/app/lib/services/work-order-service';
 *
 * const result = await workOrderService.create(voiceCommand, {
 *   userId: 'user-123',
 *   correlationId: crypto.randomUUID(),
 * });
 *
 * if (result.success) {
 *   navigate(result.resourceUrl);
 * }
 * ```
 */

import { logger } from '@/app/lib/logger';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';
import {
  sanitizeWorkOrderCommand,
  type CreateWorkOrderPayload,
} from '@/app/types/work-order-validation';
import type {
  WorkOrderServiceConfig,
  WorkOrderServiceDeps,
  RequestContext,
  WorkOrderExecutionResult,
} from './contracts/work-order-service.contracts';
import {
  WorkOrderError,
  RateLimitError,
  TimeoutError,
  ServiceUnavailableError,
  NetworkError,
} from './contracts/work-order-service.contracts';

/**
 * WorkOrderService - Cliente para Work Orders API con arquitectura robusta
 *
 * Características:
 * - Inyección de dependencias completa (testeable sin mocks globales)
 * - Observabilidad con correlation IDs y structured logging
 * - Retry logic con backoff exponencial
 * - Validación de entrada con Zod
 * - Error handling con códigos estandarizados
 * - Timeout automático por request
 */
export class WorkOrderService {
  private config: WorkOrderServiceConfig;
  private deps: WorkOrderServiceDeps;

  /**
   * Crea una instancia del servicio
   *
   * @param config - Configuración del servicio
   * @param deps - Dependencias inyectables (para testing)
   * @throws Error si la configuración es inválida
   */
  constructor(config: WorkOrderServiceConfig, deps?: Partial<WorkOrderServiceDeps>) {
    // Validación de config en constructor (fail-fast)
    if (!config.baseUrl) {
      throw new Error('baseUrl es requerido');
    }
    if (!config.apiKey) {
      throw new Error('apiKey es requerido');
    }
    if (config.timeoutMs <= 0) {
      throw new Error('timeoutMs debe ser > 0');
    }
    if (config.maxRetries < 0) {
      throw new Error('maxRetries debe ser >= 0');
    }

    this.config = config;
    this.deps = {
      fetchImpl: deps?.fetchImpl ?? fetch,
      loggerImpl: deps?.loggerImpl ?? logger,
      cryptoImpl: deps?.cryptoImpl ?? crypto,
      clockImpl: deps?.clockImpl,
      // Timer inyectable para tests con fake timers
      timerImpl: deps?.timerImpl ?? {
        setTimeout: (cb: () => void, ms: number) => globalThis.setTimeout(cb, ms),
        clearTimeout: (id: unknown) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
      },
      // Factory de AbortController para tests
      abortFactory: deps?.abortFactory ?? {
        create: () => {
          const controller = new AbortController();
          return {
            controller,
            timeoutId: null,
            abort: () => controller.abort(),
          };
        },
      },
    };
  }

  /**
   * Crea una orden de trabajo desde un comando de voz validado
   *
   * Flujo:
   * 1. Validar y sanitizar comando con Zod
   * 2. Generar correlation ID si no existe
   * 3. Intentar request con retry logic
   * 4. Loggear resultado con contexto completo
   *
   * @param command - Comando de voz parseado por Gemini
   * @param context - Contexto del usuario actual
   * @returns Resultado con resourceId para navegación
   * @throws WorkOrderError si falla tras todos los reintentos
   */
  async create(
    command: VoiceWorkOrderCommand,
    context: RequestContext
  ): Promise<WorkOrderExecutionResult> {
    const correlationId = context.correlationId || this.deps.cryptoImpl.randomUUID();
    const startTime = this.getCurrentTime();

    this.deps.loggerImpl.info('WorkOrder creation started', {
      correlationId,
      userId: context.userId,
      action: command.action,
      equipment: command.equipment,
    });

    try {
      // Validar y sanitizar input
      const payload = sanitizeWorkOrderCommand(command, context.userId);

      // Ejecutar con retry logic
      const result = await this.executeWithRetry(
        () => this.requestCreate(payload, correlationId),
        correlationId
      );

      const duration = this.getCurrentTime() - startTime;

      this.deps.loggerImpl.info('WorkOrder created successfully', {
        correlationId,
        userId: context.userId,
        resourceId: result.resourceId,
        duration,
      });

      return {
        ...result,
        metadata: { ...result.metadata, duration },
      };
    } catch (error) {
      const duration = this.getCurrentTime() - startTime;

      this.deps.loggerImpl.error('WorkOrder creation failed', error as Error, {
        correlationId,
        userId: context.userId,
        duration,
        equipment: command.equipment,
      });

      throw error;
    }
  }

  /**
   * Request interno con timeout TESTEABLE
   * Usa deps inyectadas en lugar de globals
   */
  private async requestCreate(
    payload: CreateWorkOrderPayload,
    correlationId: string
  ): Promise<WorkOrderExecutionResult> {
    // Crear abort context con factory inyectada
    const abortContext = this.deps.abortFactory!.create();

    // Programar timeout con timer inyectado (respeta fake timers)
    abortContext.timeoutId = this.deps.timerImpl!.setTimeout(() => {
      abortContext.abort();
    }, this.config.timeoutMs);

    try {
      const response = await this.deps.fetchImpl(`${this.config.baseUrl}/api/work-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify(payload),
        signal: abortContext.controller.signal,
      });

      if (!response.ok) {
        throw await this.parseErrorResponse(response, correlationId);
      }

      const data = await response.json();
      return this.normalizeSuccessResponse(data);
    } catch (error) {
      // Manejar abort por timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(`Request exceeded ${this.config.timeoutMs}ms timeout`);
      }
      // Manejar errores de red
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(`Network error: ${error.message}`);
      }
      throw error;
    } finally {
      // Limpiar timeout con timer inyectado
      if (abortContext.timeoutId !== null) {
        this.deps.timerImpl!.clearTimeout(abortContext.timeoutId);
      }
    }
  }

  /**
   * Parsea respuestas de error del backend
   * Convierte HTTP status codes a errores tipados
   */
  private async parseErrorResponse(
    response: Response,
    correlationId: string
  ): Promise<WorkOrderError> {
    const errorData = await response.json().catch(() => ({}));

    switch (response.status) {
      case 400:
        return new WorkOrderError(
          errorData.message || 'Invalid request data',
          'VALIDATION_ERROR',
          false,
          400,
          correlationId
        );

      case 401:
        return new WorkOrderError(
          errorData.message || 'Authentication required',
          'UNAUTHORIZED',
          false,
          401,
          correlationId
        );

      case 403:
        return new WorkOrderError(
          errorData.message || 'Insufficient permissions',
          'FORBIDDEN',
          false,
          403,
          correlationId
        );

      case 404:
        return new WorkOrderError(
          errorData.message || 'Resource not found',
          'NOT_FOUND',
          false,
          404,
          correlationId
        );

      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        return new RateLimitError(errorData.message || 'Rate limit exceeded', retryAfter);
      }

      case 503:
        return new ServiceUnavailableError(errorData.message || 'Service temporarily unavailable');

      default:
        return new WorkOrderError(
          `HTTP ${response.status}: ${errorData.message || 'Unknown error'}`,
          'INTERNAL_ERROR',
          response.status >= 500, // Errores 5xx son recuperables
          response.status,
          correlationId
        );
    }
  }

  /**
   * Normaliza respuesta exitosa del backend
   */
  private normalizeSuccessResponse(data: Record<string, unknown>): WorkOrderExecutionResult {
    return {
      success: true,
      message: (data.message as string) || 'Work order created successfully',
      resourceId: (data.id as string) || (data.workOrderId as string),
      resourceUrl: (data.url as string) || `/work-orders/${data.id}`,
      metadata: data.metadata as WorkOrderExecutionResult['metadata'],
    };
  }

  /**
   * Ejecuta request con retry logic y backoff exponencial
   *
   * Reintentos solo para errores recuperables:
   * - 429 Rate Limit (respeta Retry-After)
   * - 503 Service Unavailable
   * - Timeouts
   * - Errores de red
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, correlationId: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.config.maxRetries;

        // Determinar si es recuperable
        const isRecoverable =
          error instanceof TimeoutError ||
          error instanceof ServiceUnavailableError ||
          error instanceof NetworkError ||
          (error instanceof WorkOrderError && error.recoverable);

        if (!isRecoverable || isLastAttempt) {
          throw error;
        }

        // Calcular backoff (respeta Retry-After si es RateLimitError)
        let backoffMs: number;
        if (error instanceof RateLimitError) {
          backoffMs = error.retryAfter * 1000;
        } else {
          backoffMs = Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30s
        }

        this.deps.loggerImpl.warn('Retrying request', {
          correlationId,
          attempt,
          maxRetries: this.config.maxRetries,
          backoffMs,
          errorCode: error instanceof WorkOrderError ? error.code : 'UNKNOWN',
        });

        await this.sleep(backoffMs);
      }
    }

    throw lastError;
  }

  /**
   * Consulta estado de una orden existente
   */
  async checkStatus(orderId: string, context: RequestContext): Promise<WorkOrderExecutionResult> {
    const correlationId = context.correlationId || this.deps.cryptoImpl.randomUUID();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await this.deps.fetchImpl(
        `${this.config.baseUrl}/api/work-orders/${orderId}/status`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Correlation-ID': correlationId,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.parseErrorResponse(response, correlationId);
      }

      const data = await response.json();
      return {
        success: true,
        message: `Status: ${data.status}`,
        resourceId: orderId,
        metadata: data,
      };
    } catch (error) {
      this.deps.loggerImpl.error('Failed to check status', error as Error, {
        correlationId,
        orderId,
      });
      throw error;
    }
  }

  /**
   * Lista órdenes pendientes
   */
  async listPending(context: RequestContext): Promise<WorkOrderExecutionResult> {
    const correlationId = context.correlationId || this.deps.cryptoImpl.randomUUID();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await this.deps.fetchImpl(
        `${this.config.baseUrl}/api/work-orders?status=pending&userId=${context.userId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Correlation-ID': correlationId,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await this.parseErrorResponse(response, correlationId);
      }

      const data = await response.json();
      return {
        success: true,
        message: `Found ${data.items?.length || 0} pending orders`,
        metadata: { items: data.items, total: data.total },
      };
    } catch (error) {
      this.deps.loggerImpl.error('Failed to list pending orders', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Obtiene el tiempo actual (inyectable para testing)
   */
  private getCurrentTime(): number {
    return this.deps.clockImpl?.now() ?? Date.now();
  }

  /**
   * Sleep helper TESTEABLE
   * Usa timer inyectado (respeta fake timers)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.deps.timerImpl!.setTimeout(() => resolve(), ms);
    });
  }
}

/**
 * Singleton instance (lazy initialization)
 */
let _workOrderServiceInstance: WorkOrderService | null = null;

/**
 * Obtiene la instancia singleton del servicio
 * La inicialización se pospone hasta el primer uso para permitir
 * que los tests configuren variables de entorno primero
 */
export function getWorkOrderService(): WorkOrderService {
  if (!_workOrderServiceInstance) {
    _workOrderServiceInstance = new WorkOrderService({
      baseUrl: process.env.NEXT_PUBLIC_BACKEND_API_URL || '',
      apiKey: process.env.BACKEND_API_KEY || '',
      timeoutMs: 30000,
      maxRetries: 3,
    });
  }
  return _workOrderServiceInstance;
}

/**
 * Resetea el singleton (solo para tests)
 * @internal
 */
export function _resetWorkOrderService(): void {
  _workOrderServiceInstance = null;
}
