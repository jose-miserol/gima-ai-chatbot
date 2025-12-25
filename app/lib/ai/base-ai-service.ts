/**
 * BaseAIService - Clase abstracta para servicios de IA
 *
 * Proporciona funcionalidad común para todos los servicios que usan IA:
 * - Retry logic con backoff exponencial
 * - Caching de respuestas
 * - Rate limiting awareness
 * - Validación con Zod
 * - Logging estructurado
 * - Error handling tipado
 *
 * @example
 * ```typescript
 * export class ChecklistAIService extends BaseAIService {
 *   async generateChecklist(request: ChecklistRequest) {
 *     const validated = this.validate(ChecklistRequestSchema, request);
 *
 *     return this.executeWithRetry(async () => {
 *       const cached = await this.checkCache(cacheKey);
 *       if (cached) return cached;
 *
 *       const result = await this.callAI(prompt);
 *       await this.setCache(cacheKey, result);
 *       return result;
 *     });
 *   }
 * }
 * ```
 */

import { logger } from '@/app/lib/logger';
import { z } from 'zod';

/**
 * Configuración base para servicios de IA
 */
export interface AIServiceConfig {
  /**
   * Nombre del servicio para logging
   */
  serviceName: string;

  /**
   * Timeout en milisegundos para requests a IA
   * @default 30000 (30 segundos)
   */
  timeoutMs?: number;

  /**
   * Número máximo de reintentos
   * @default 3
   */
  maxRetries?: number;

  /**
   * Habilitar caching de responses
   * @default true
   */
  enableCaching?: boolean;

  /**
   * TTL del cache en segundos
   * @default 3600 (1 hora)
   */
  cacheTTL?: number;
}

/**
 * Dependencias inyectables para testing
 */
export interface AIServiceDeps {
  logger?: typeof logger;
  cache?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}

/**
 * Error personalizado para servicios de IA
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly recoverable: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * Error de timeout en llamada a IA
 */
export class AITimeoutError extends AIServiceError {
  constructor(serviceName: string, timeoutMs: number) {
    super(
      `AI request timed out after ${timeoutMs}ms`,
      serviceName,
      true // Timeout es recuperable
    );
    this.name = 'AITimeoutError';
  }
}

/**
 * Error de validación de schema
 */
export class AIValidationError extends AIServiceError {
  constructor(serviceName: string, zodError: z.ZodError) {
    super(
      `Validation failed: ${zodError.message}`,
      serviceName,
      false // Validation errors no son recuperables
    );
    this.name = 'AIValidationError';
  }
}

/**
 * BaseAIService - Clase abstracta con funcionalidad común
 */
export abstract class BaseAIService {
  protected config: Required<AIServiceConfig>;
  protected deps: AIServiceDeps;

  constructor(config: AIServiceConfig, deps?: AIServiceDeps) {
    this.config = {
      serviceName: config.serviceName,
      timeoutMs: config.timeoutMs ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL ?? 3600,
    };

    this.deps = {
      logger: deps?.logger ?? logger,
      cache: deps?.cache ?? this.createLocalStorageCache(),
    };
  }

  /**
   * Valida datos con un schema Zod
   *
   * @throws AIValidationError si la validación falla
   */
  protected validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AIValidationError(this.config.serviceName, error);
      }
      throw error;
    }
  }

  /**
   * Ejecuta función con retry logic
   *
   * Solo reintentar en errores recuperables:
   * - Timeouts
   * - Errores de red
   * - Errores 5xx del server
   */
  protected async executeWithRetry<T>(fn: () => Promise<T>, correlationId?: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.config.maxRetries;

        // Solo recuperable si es AIServiceError con flag o es timeout
        const isRecoverable =
          error instanceof AITimeoutError || (error instanceof AIServiceError && error.recoverable);

        if (!isRecoverable || isLastAttempt) {
          throw error;
        }

        // Backoff exponencial
        const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 30000);

        this.deps.logger?.warn('Retrying AI request', {
          serviceName: this.config.serviceName,
          attempt,
          maxRetries: this.config.maxRetries,
          backoffMs,
          correlationId,
        });

        await this.sleep(backoffMs);
      }
    }

    throw lastError;
  }

  /**
   * Verifica cache (solo si caching está habilitado)
   */
  protected async checkCache<T>(key: string): Promise<T | null> {
    if (!this.config.enableCaching || !this.deps.cache) {
      return null;
    }

    try {
      const cached = await this.deps.cache.get(key);
      if (cached) {
        this.deps.logger?.info('Cache hit', {
          serviceName: this.config.serviceName,
          cacheKey: key,
        });
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.deps.logger?.warn('Cache read failed', {
        serviceName: this.config.serviceName,
        cacheKey: key,
        error,
      });
    }

    return null;
  }

  /**
   * Guarda en cache
   */
  protected async setCache(key: string, value: unknown): Promise<void> {
    if (!this.config.enableCaching || !this.deps.cache) {
      return;
    }

    try {
      await this.deps.cache.set(key, JSON.stringify(value), this.config.cacheTTL);

      this.deps.logger?.info('Cache set', {
        serviceName: this.config.serviceName,
        cacheKey: key,
        ttl: this.config.cacheTTL,
      });
    } catch (error) {
      this.deps.logger?.warn('Cache write failed', {
        serviceName: this.config.serviceName,
        cacheKey: key,
        error,
      });
    }
  }

  /**
   * Genera clave de cache consistente
   */
  protected buildCacheKey(parts: Array<string | number>): string {
    return `${this.config.serviceName}:${parts.join(':')}`;
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Crea implementación simple de cache con localStorage
   * (Solo para cliente, en servidor usar Redis/Upstash)
   */
  private createLocalStorageCache() {
    // Check if localStorage is available (client-side)
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
      };
    }

    return {
      get: async (key: string) => {
        try {
          const item = localStorage.getItem(key);
          if (!item) return null;

          const { value, expiry } = JSON.parse(item);
          if (expiry && Date.now() > expiry) {
            localStorage.removeItem(key);
            return null;
          }

          return value;
        } catch {
          return null;
        }
      },
      set: async (key: string, value: string, ttl?: number) => {
        try {
          const expiry = ttl ? Date.now() + ttl * 1000 : null;
          localStorage.setItem(key, JSON.stringify({ value, expiry }));
        } catch {
          // Silently fail (quota exceeded, etc.)
        }
      },
      delete: async (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Silently fail
        }
      },
    };
  }
}
