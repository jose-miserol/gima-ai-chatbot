/**
 * @file work-order-service.ts
 * @module app/lib/services/work-order-service
 *
 * ============================================================
 * SERVICIO — CLIENTE HTTP PARA ÓRDENES DE TRABAJO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `WorkOrderService`, el cliente HTTP que comunica GIMA con el
 *   endpoint de Work Orders del backend Laravel. Dado un comando de voz
 *   ya parseado por `VoiceCommandParserService`, este servicio lo convierte
 *   en una petición POST al backend y retorna un resultado estructurado
 *   con el ID y URL del recurso creado.
 *
 *   También expone `getWorkOrderService()`, una factory de singleton lazy
 *   que crea la instancia con la configuración del entorno.
 *
 * CONTEXTO EN GIMA:
 *   El flujo principal de creación de OT por voz es:
 *   [micrófono] → transcribeAudio → parseCommand → executeVoiceCommand
 *   → WorkOrderService.create → [backend Laravel POST /api/work-orders]
 *
 *   Este servicio es el último eslabón: recibe el comando ya validado y
 *   estructurado y lo ejecuta contra el backend real (o simulado en modo demo).
 *
 * MODO DEMO:
 *   Cuando `NEXT_PUBLIC_DEMO_MODE=true`, el servicio simula el backend:
 *   - Introduce un delay artificial de 1.5-2.5s (realismo de red).
 *   - Retorna éxito el 90% de las veces y falla el 10% (para demostrar
 *     el manejo de errores en la UI).
 *   Esto permite demos y pruebas de UI sin backend real disponible.
 *
 * ARQUITECTURA TESTEABLE:
 *   Todas las dependencias externas son inyectables via `WorkOrderServiceDeps`:
 *   - `fetchImpl`    → Reemplazable por un fetch mock en tests.
 *   - `loggerImpl`   → Reemplazable por un spy para verificar logs.
 *   - `cryptoImpl`   → Reemplazable para UUIDs deterministas en tests.
 *   - `clockImpl`    → Reemplazable para time-travel testing.
 *   - `timerImpl`    → Reemplazable para controlar delays con fake timers.
 *   - `abortFactory` → Reemplazable para simular timeouts sin esperar.
 *
 * RETRY LOGIC:
 *   Solo se reintentan errores recuperables:
 *   - TimeoutError           → AbortController disparado por `timeoutMs`.
 *   - ServiceUnavailableError → HTTP 503 (backend en mantenimiento).
 *   - NetworkError           → Error de red (DNS, conexión rechazada).
 *   - RateLimitError         → HTTP 429 (respeta el header `Retry-After`).
 *   Errores 4xx (400, 401, 403, 404) NO se reintentan porque son fallos
 *   de datos o permisos que no se resuelven reintentando.
 *
 * SINGLETON LAZY:
 *   `getWorkOrderService()` pospone la creación hasta el primer uso para
 *   que los tests puedan configurar las variables de entorno antes de que
 *   el servicio las lea. `_resetWorkOrderService()` permite resetear el
 *   singleton entre tests (solo uso interno/testing).
 *
 */

import { logger } from '@/app/lib/logger';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';
import {
  sanitizeWorkOrderCommand,
  type CreateWorkOrderPayload,
} from '@/app/types/work-order-validation';

import {
  WorkOrderError,
  RateLimitError,
  TimeoutError,
  ServiceUnavailableError,
  NetworkError,
} from './contracts/work-order-service.contracts';

import type {
  WorkOrderServiceConfig,
  WorkOrderServiceDeps,
  RequestContext,
  WorkOrderExecutionResult,
} from './contracts/work-order-service.contracts';

// ============================================================
// SERVICIO: WorkOrderService
// ============================================================

/**
 * Cliente HTTP para el API de Work Orders con arquitectura robusta y testeable.
 *
 * @example
 * ```typescript
 * const service = getWorkOrderService();
 * const result = await service.create(voiceCommand, {
 *   userId: 'user-123',
 *   correlationId: crypto.randomUUID(),
 * });
 *
 * if (result.success) {
 *   router.push(result.resourceUrl);
 * }
 * ```
 */
export class WorkOrderService {
  private config: WorkOrderServiceConfig;
  private deps: WorkOrderServiceDeps;

  /**
   * @param config - Configuración del servicio (baseUrl, apiKey, timeouts).
   * @param deps   - Dependencias inyectables. En producción usa los globals.
   * @throws Error si la configuración es inválida (fail-fast en constructor).
   */
  constructor(config: WorkOrderServiceConfig, deps?: Partial<WorkOrderServiceDeps>) {
    // Validación fail-fast: detectar configuraciones inválidas al inicio,
    // no durante el primer request en producción.
    if (!config.baseUrl) throw new Error('baseUrl es requerido');
    if (!config.apiKey) throw new Error('apiKey es requerido');
    if (config.timeoutMs <= 0) throw new Error('timeoutMs debe ser > 0');
    if (config.maxRetries < 0) throw new Error('maxRetries debe ser >= 0');

    this.config = config;
    this.deps = {
      fetchImpl: deps?.fetchImpl ?? fetch,
      loggerImpl: deps?.loggerImpl ?? logger,
      cryptoImpl: deps?.cryptoImpl ?? crypto,
      clockImpl: deps?.clockImpl,
      timerImpl: deps?.timerImpl ?? {
        setTimeout: (cb: () => void, ms: number) => globalThis.setTimeout(cb, ms),
        clearTimeout: (id: unknown) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
      },
      abortFactory: deps?.abortFactory ?? {
        create: () => {
          const controller = new AbortController();
          return { controller, timeoutId: null, abort: () => controller.abort() };
        },
      },
    };
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  /**
   * Crea una orden de trabajo a partir de un comando de voz validado.
   *
   * QUÉ HACE (paso a paso):
   *   1. Genera o usa el correlationId para tracing distribuido.
   *   2. En modo demo: simula respuesta con delay artificial y 10% de error.
   *   3. Sanitiza y valida el comando con Zod antes de enviarlo.
   *   4. Ejecuta el request con retry logic para errores recuperables.
   *   5. Loguea el resultado con métricas de duración.
   *
   * @param command - Comando de voz parseado y validado por VoiceCommandParserService.
   * @param context - Contexto del usuario (userId, correlationId para tracing).
   * @returns Resultado con resourceId y resourceUrl para navegación post-creación.
   * @throws WorkOrderError si todos los reintentos fallan.
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

    // Modo demo: simular backend sin conexión real
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      this.deps.loggerImpl.info('Demo mode enabled - simulating backend response', {
        correlationId,
      });

      // Delay realista de red (1.5-2.5s)
      await this.sleep(1500 + Math.random() * 1000);

      const duration = this.getCurrentTime() - startTime;

      // 90% éxito, 10% error — para demostrar manejo de errores en el UI
      if (Math.random() > 0.1) {
        const demoResult: WorkOrderExecutionResult = {
          success: true,
          message: 'Orden de trabajo creada exitosamente (Demo)',
          resourceId: `demo-wo-${Date.now()}`,
          resourceUrl: `/work-orders/demo-wo-${Date.now()}`,
          metadata: {
            duration,
            demo: true,
            equipment: command.equipment,
            priority: command.priority,
          },
        };

        this.deps.loggerImpl.info('WorkOrder created successfully (Demo)', {
          correlationId,
          resourceId: demoResult.resourceId,
          duration,
        });

        return demoResult;
      } else {
        throw new ServiceUnavailableError('Error simulado en modo demo (10% probabilidad)');
      }
    }

    try {
      // Sanitizar y validar el comando de voz antes de enviarlo al backend.
      // sanitizeWorkOrderCommand convierte VoiceWorkOrderCommand → CreateWorkOrderPayload.
      const payload = sanitizeWorkOrderCommand(command, context.userId);

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

      return { ...result, metadata: { ...result.metadata, duration } };
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
   * Consulta el estado de una orden de trabajo existente.
   *
   * @param orderId - ID del work order a consultar.
   * @param context - Contexto del usuario para autenticación y tracing.
   * @returns Resultado con el estado actual de la OT en `metadata`.
   * @throws WorkOrderError si el request falla.
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
   * Lista las órdenes de trabajo pendientes del usuario actual.
   *
   * @param context - Contexto del usuario. `userId` se incluye como filtro en la query.
   * @returns Resultado con `metadata.items` (array de OTs) y `metadata.total`.
   * @throws WorkOrderError si el request falla.
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

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Ejecuta el request POST de creación de OT con timeout testeable.
   *
   * Usa las dependencias inyectadas (`abortFactory`, `timerImpl`) en lugar
   * de `AbortController` y `setTimeout` globales, lo que permite controlar
   * el timeout en tests con fake timers sin depender del event loop real.
   *
   * @param payload       - Datos de la OT a crear (validados por sanitizeWorkOrderCommand).
   * @param correlationId - ID para tracing distribuido (header X-Correlation-ID).
   * @returns Resultado normalizado del backend.
   * @throws TimeoutError si el request supera `timeoutMs`.
   * @throws NetworkError si hay un error de conectividad.
   * @throws WorkOrderError para cualquier otro error HTTP.
   */
  private async requestCreate(
    payload: CreateWorkOrderPayload,
    correlationId: string
  ): Promise<WorkOrderExecutionResult> {
    const abortContext = this.deps.abortFactory!.create();

    // Programar el timeout usando el timer inyectado (respeta fake timers en tests)
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
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(`Request exceeded ${this.config.timeoutMs}ms timeout`);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(`Network error: ${error.message}`);
      }
      throw error;
    } finally {
      // Limpiar el timeout siempre, incluso si el request tuvo éxito
      if (abortContext.timeoutId !== null) {
        this.deps.timerImpl!.clearTimeout(abortContext.timeoutId);
      }
    }
  }

  /**
   * Convierte una respuesta HTTP de error en un error tipado de GIMA.
   *
   * MAPEO DE STATUS CODES:
   *   400 → VALIDATION_ERROR (no recuperable)
   *   401 → UNAUTHORIZED (no recuperable)
   *   403 → FORBIDDEN (no recuperable)
   *   404 → NOT_FOUND (no recuperable)
   *   429 → RATE_LIMITED (recuperable, respeta Retry-After)
   *   503 → SERVICE_UNAVAILABLE (recuperable)
   *   5xx → INTERNAL_ERROR (recuperable)
   *
   * @param response      - Response HTTP con status de error (no ok).
   * @param correlationId - ID para incluir en el error (facilita correlación en logs).
   * @returns Error tipado correspondiente al status HTTP.
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
          response.status >= 500, // Solo errores 5xx son recuperables con retry
          response.status,
          correlationId
        );
    }
  }

  /**
   * Normaliza la respuesta exitosa del backend al formato `WorkOrderExecutionResult`.
   *
   * El backend puede retornar el ID como `id` o `workOrderId` según el endpoint.
   * La URL puede venir del backend o se construye localmente como fallback.
   *
   * @param data - JSON parseado de la respuesta HTTP del backend.
   * @returns WorkOrderExecutionResult normalizado.
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
   * Retry loop con backoff exponencial para errores recuperables.
   *
   * BACKOFF:
   *   - Errores normales: `min(2^attempt * 1000, 30000)` ms (máx 30s).
   *   - RateLimitError:   usa el valor de `Retry-After` del servidor (en segundos).
   *
   * @param fn            - Función async a ejecutar con retry.
   * @param correlationId - ID para incluir en los logs de cada intento.
   * @returns Resultado de `fn` si tiene éxito en algún intento.
   * @throws El último error si todos los intentos fallan.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, correlationId: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.config.maxRetries;

        const isRecoverable =
          error instanceof TimeoutError ||
          error instanceof ServiceUnavailableError ||
          error instanceof NetworkError ||
          (error instanceof WorkOrderError && error.recoverable);

        if (!isRecoverable || isLastAttempt) {
          throw error;
        }

        // RateLimitError respeta el Retry-After del servidor
        const backoffMs =
          error instanceof RateLimitError
            ? error.retryAfter * 1000
            : Math.min(Math.pow(2, attempt) * 1000, 30000);

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

  /** Tiempo actual en ms. Inyectable para time-travel testing. */
  private getCurrentTime(): number {
    return this.deps.clockImpl?.now() ?? Date.now();
  }

  /**
   * Sleep helper que usa el timer inyectado (respeta fake timers en tests).
   * @param ms - Milisegundos a esperar.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.deps.timerImpl!.setTimeout(() => resolve(), ms);
    });
  }
}

// ============================================================
// FACTORY / SINGLETON
// ============================================================

/** Instancia singleton con inicialización lazy. */
let _workOrderServiceInstance: WorkOrderService | null = null;

/**
 * Retorna la instancia singleton del WorkOrderService.
 *
 * LAZY INITIALIZATION:
 *   La instancia se crea en el primer uso, no al importar el módulo.
 *   Esto permite que los tests configuren variables de entorno antes
 *   de que el servicio las lea en el constructor.
 *
 * MODO DEMO:
 *   Si `NEXT_PUBLIC_DEMO_MODE=true`, usa URLs y claves ficticias.
 *   El servicio intercepta las llamadas antes de llegar al fetch.
 *
 * @returns Instancia singleton configurada con las variables de entorno.
 */
export function getWorkOrderService(): WorkOrderService {
  if (!_workOrderServiceInstance) {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    _workOrderServiceInstance = new WorkOrderService({
      baseUrl: process.env.NEXT_PUBLIC_BACKEND_API_URL || (isDemo ? 'https://demo.local' : ''),
      apiKey: process.env.BACKEND_API_KEY || (isDemo ? 'demo-key' : ''),
      timeoutMs: 30000,
      maxRetries: 3,
    });
  }
  return _workOrderServiceInstance;
}

/**
 * Resetea el singleton para tests.
 * Permite que cada test cree una instancia nueva con su propia configuración.
 * @internal No usar en código de producción.
 */
export function _resetWorkOrderService(): void {
  _workOrderServiceInstance = null;
}
