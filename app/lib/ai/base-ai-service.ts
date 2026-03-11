/**
 * @file base-ai-service.ts
 * @module app/lib/ai/base-ai-service
 *
 * ============================================================
 * CLASE ABSTRACTA — BASE PARA TODOS LOS SERVICIOS DE IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define `BaseAIService`, la clase abstracta de la que heredan todos los
 *   servicios de IA de GIMA (checklist, resúmenes, cierre de OT, parser de
 *   voz, etc.). Concentra la lógica transversal que de otro modo estaría
 *   duplicada en cada servicio:
 *     - Retry con backoff exponencial para errores recuperables.
 *     - Cache con TTL configurable (localStorage en cliente, Redis/Upstash en servidor).
 *     - Validación de entrada/salida con Zod.
 *     - Logging estructurado por componente.
 *
 * CONTEXTO EN GIMA:
 *   GIMA cuenta con múltiples features de IA (generación de checklists,
 *   resúmenes de actividades, cierre de OT, parser de comandos de voz).
 *   Todas comparten el mismo ciclo: validar → consultar cache → llamar LLM →
 *   cachear → retornar. `BaseAIService` abstrae ese ciclo para que cada
 *   servicio concreto solo implemente la lógica de negocio específica.
 *
 * JERARQUÍA DE SERVICIOS:
 *   BaseAIService (abstracta)
 *   ├── ChecklistAIService          → genera checklists con GROQ
 *   ├── ActivitySummaryAIService    → genera resúmenes con GROQ
 *   ├── WorkOrderCloseoutAIService  → genera notas de cierre con GROQ
 *   └── VoiceCommandParserService   → parsea comandos de voz con Gemini
 *
 * POR QUÉ INYECCIÓN DE DEPENDENCIAS:
 *   Todos los componentes externos (logger, cache) se inyectan via `deps`
 *   para que los tests puedan sustituirlos sin mocks globales. El patrón
 *   permite tests unitarios rápidos y deterministas.
 *
 * ESTRATEGIA DE CACHE:
 *   En cliente: localStorage con TTL manual (expiry en el propio JSON).
 *   En servidor (Next.js): se debe inyectar un cliente Redis/Upstash via deps.
 *   Si localStorage no está disponible (SSR), el cache devuelve null silenciosamente
 *   y el servicio llama a la API sin cache.
 *
 * ESTRATEGIA DE RETRY:
 *   Solo se reintenta en errores marcados como `recoverable: true`:
 *   - Timeouts (AITimeoutError).
 *   - Errores de red transitorios.
 *   - Errores 5xx del LLM provider.
 *   Los errores de validación (AIValidationError) NO se reintentan porque
 *   volver a enviar los mismos datos producirá el mismo error.
 *
 * ERRORES EXPORTADOS:
 *   - AIServiceError     → Error base tipado. Incluye `serviceName` y `recoverable`.
 *   - AITimeoutError     → Request al LLM superó `timeoutMs`. Recuperable.
 *   - AIValidationError  → Zod rechazó los datos. No recuperable.
 *
 */

import { z } from 'zod';

import { logger } from '@/app/lib/logger';

// ============================================================
// INTERFACES DE CONFIGURACIÓN Y DEPENDENCIAS
// ============================================================

/**
 * Configuración base que recibe cualquier servicio de IA concreto.
 *
 * TODOS LOS CAMPOS CON DEFAULT son opcionales — el servicio concreto
 * solo necesita pasar `serviceName` como mínimo, y puede sobrescribir
 * cualquier valor según sus necesidades (ej. un servicio de audio puede
 * necesitar `timeoutMs: 60000` por la duración del procesamiento).
 */
export interface AIServiceConfig {
  /**
   * Nombre del servicio para logging.
   * Se usa como prefijo en todos los mensajes de log y en las cache keys,
   * asegurando que distintos servicios no compartan entradas de cache.
   */
  serviceName: string;

  /**
   * Timeout en milisegundos para requests a la API del LLM.
   * Pasado este límite se lanza AITimeoutError (recoverable).
   * @default 30000 (30 segundos)
   */
  timeoutMs?: number;

  /**
   * Número máximo de reintentos ante errores recuperables.
   * Después del último intento fallido se propaga el error al caller.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Habilitar caching de respuestas del LLM.
   * Deshabilitar en servicios donde los datos cambian frecuentemente
   * o donde la frescura es crítica (ej. datos de inventario en tiempo real).
   * @default true
   */
  enableCaching?: boolean;

  /**
   * TTL del cache en segundos.
   * Pasado este tiempo, la entrada se considera expirada y se llama al LLM.
   * Ajustar según la volatilidad del contenido generado:
   * - Checklists: 3600s (cambian poco)
   * - Resúmenes: 3600s
   * - Notas de cierre: 1800s (más específicas por OT)
   * @default 3600 (1 hora)
   */
  cacheTTL?: number;
}

/**
 * Dependencias inyectables para testing y extensión.
 *
 * En producción las dependencias por defecto son suficientes.
 * En tests se inyectan doubles (stubs, spies) para:
 * - Verificar que el logger recibe los mensajes correctos.
 * - Simular un cache vacío o con datos pre-populados.
 * - Evitar llamadas reales a localStorage en JSDOM.
 */
export interface AIServiceDeps {
  /** Logger estructurado. Por defecto usa el logger global del proyecto. */
  logger?: typeof logger;
  /** Implementación de cache. Por defecto usa localStorage con TTL. */
  cache?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}

// ============================================================
// ERRORES PERSONALIZADOS
// ============================================================

/**
 * Error base para todos los servicios de IA de GIMA.
 *
 * Extiende Error con tres propiedades adicionales que el caller puede
 * usar para decidir si reintentar, mostrar un mensaje de error específico,
 * o registrar el error original para debugging.
 *
 * CUÁNDO USARLO:
 *   Lanzar directamente cuando el error no encaja en AITimeoutError o
 *   AIValidationError. El caller comprueba `recoverable` para decidir
 *   si tiene sentido reintentar la operación.
 */
export class AIServiceError extends Error {
  /**
   * @param message        - Mensaje legible del error.
   * @param serviceName    - Nombre del servicio que lo originó (para logging).
   * @param recoverable    - Si es `true`, el servicio reintentará la operación.
   * @param originalError  - Error original (útil para stack trace en Sentry).
   */
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
 * Error de timeout en llamada al LLM.
 *
 * Se lanza cuando el request al proveedor de IA supera `timeoutMs`.
 * Marcado como `recoverable: true` porque el LLM puede haber estado
 * temporalmente sobrecargado; un reintento suele resolver el problema.
 *
 * CUÁNDO OCURRE:
 *   - PDFs o audios muy grandes que tardan más de lo esperado en procesar.
 *   - Picos de carga en la API del proveedor (Gemini/GROQ).
 *   - Conexiones lentas en entornos de staging.
 */
export class AITimeoutError extends AIServiceError {
  /**
   * @param serviceName - Nombre del servicio para logging.
   * @param timeoutMs   - Límite de tiempo configurado (para incluir en el mensaje).
   */
  constructor(serviceName: string, timeoutMs: number) {
    super(
      `AI request timed out after ${timeoutMs}ms`,
      serviceName,
      true // Timeout es recuperable — el reintento puede llegar en un momento de menor carga
    );
    this.name = 'AITimeoutError';
  }
}

/**
 * Error de validación del schema Zod.
 *
 * Se lanza cuando los datos (request o response) no superan la validación
 * con el schema Zod correspondiente. Marcado como `recoverable: false`
 * porque volver a enviar los mismos datos inválidos producirá el mismo error.
 *
 * CUÁNDO OCURRE:
 *   - El LLM devuelve un JSON con campos faltantes o de tipo incorrecto.
 *   - El caller pasa parámetros de entrada con valores fuera del enum.
 *   - El schema evolucionó y los datos en cache son del formato antiguo.
 */
export class AIValidationError extends AIServiceError {
  /**
   * @param serviceName - Nombre del servicio para logging.
   * @param zodError    - Error de Zod con detalle de qué campo falló.
   */
  constructor(serviceName: string, zodError: z.ZodError) {
    super(
      `Validation failed: ${zodError.message}`,
      serviceName,
      false // Validación fallida no es recuperable con retry
    );
    this.name = 'AIValidationError';
  }
}

// ============================================================
// CLASE ABSTRACTA: BaseAIService
// ============================================================

/**
 * Clase abstracta con funcionalidad transversal para servicios de IA.
 *
 * CÓMO EXTENDER:
 *   1. Crear la clase concreta extendiendo BaseAIService.
 *   2. Llamar a `super()` con la configuración específica del servicio.
 *   3. Implementar la lógica de negocio usando los métodos protegidos
 *      `validate`, `executeWithRetry`, `checkCache`, `setCache` y `buildCacheKey`.
 *
 * @example
 * ```typescript
 * export class MyAIService extends BaseAIService {
 *   constructor() {
 *     super({ serviceName: 'MyAIService', cacheTTL: 1800 });
 *   }
 *
 *   async generate(input: MyInput): Promise<MyOutput> {
 *     const validated = this.validate(myInputSchema, input);
 *     const cacheKey = this.buildCacheKey([validated.id, validated.type]);
 *
 *     return this.executeWithRetry(async () => {
 *       const cached = await this.checkCache<MyOutput>(cacheKey);
 *       if (cached) return cached;
 *
 *       const result = await callLLM(validated);
 *       await this.setCache(cacheKey, result);
 *       return result;
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseAIService {
  protected config: Required<AIServiceConfig>;
  protected deps: AIServiceDeps;

  /**
   * @param config - Configuración del servicio. Solo `serviceName` es obligatorio.
   * @param deps   - Dependencias inyectables. En producción se usan los defaults.
   */
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

  // ============================================================
  // MÉTODOS PROTEGIDOS — Para uso en subclases
  // ============================================================

  /**
   * Valida datos contra un schema Zod.
   *
   * Si la validación falla lanza AIValidationError (no recuperable),
   * que el retry loop de `executeWithRetry` no reintentará.
   *
   * CUÁNDO USARLO:
   *   - Antes de llamar al LLM: para validar el input del usuario.
   *   - Después de recibir la respuesta del LLM: para garantizar que el
   *     JSON devuelto tiene la estructura correcta antes de retornarlo al caller.
   *
   * @param schema - Schema Zod que define la forma esperada de los datos.
   * @param data   - Datos a validar (pueden ser `unknown` del JSON.parse).
   * @returns Los datos validados y tipados como `T`.
   * @throws AIValidationError si la validación falla.
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
   * Ejecuta una función con retry logic y backoff exponencial.
   *
   * CUÁNDO REINTENTA:
   *   Solo reintenta si el error lanzado es `recoverable: true`. Esto incluye
   *   AITimeoutError y cualquier AIServiceError con `recoverable: true`.
   *   Los errores de validación (recoverable: false) se propagan inmediatamente.
   *
   * CÁLCULO DE BACKOFF:
   *   `backoffMs = min(2^attempt * 1000, 30000)`
   *   Intento 1 → 2s, Intento 2 → 4s, Intento 3 → 8s... hasta 30s máximo.
   *
   * @param fn              - Función async a ejecutar con retry.
   * @param correlationId   - ID opcional para tracing distribuido en los logs.
   * @returns El resultado de `fn` si tiene éxito dentro del límite de reintentos.
   * @throws El último error si se agotaron todos los reintentos.
   */
  protected async executeWithRetry<T>(fn: () => Promise<T>, correlationId?: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.config.maxRetries;

        const isRecoverable =
          error instanceof AITimeoutError || (error instanceof AIServiceError && error.recoverable);

        if (!isRecoverable || isLastAttempt) {
          throw error;
        }

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
   * Verifica si existe una respuesta cacheada para la clave dada.
   *
   * Retorna `null` silenciosamente (sin lanzar) en los siguientes casos:
   *   - Caching deshabilitado en la configuración (`enableCaching: false`).
   *   - No hay implementación de cache disponible.
   *   - La entrada ha expirado (TTL superado en localStorage).
   *   - Error al leer el cache (corrupción de datos, quota exceeded, etc.).
   *
   * @param key - Clave de cache generada con `buildCacheKey`.
   * @returns El valor cacheado deserializado, o `null` si no existe/expiró.
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
   * Almacena un valor en cache serializado como JSON.
   *
   * Falla silenciosamente si el cache no está disponible o hay un error
   * de escritura (quota exceeded, localStorage lleno, etc.). El fallo
   * del cache no debe interrumpir el flujo principal del servicio.
   *
   * @param key   - Clave de cache generada con `buildCacheKey`.
   * @param value - Valor a cachear. Debe ser serializable a JSON.
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
   * Genera una clave de cache con namespace por servicio.
   *
   * El formato `serviceName:part1:part2:...` garantiza que servicios
   * distintos no colisionen aunque usen los mismos parámetros.
   *
   * @example
   *   // En ChecklistAIService:
   *   this.buildCacheKey(['bomba', 'preventivo', 'default'])
   *   // → "ChecklistAIService:bomba:preventivo:default"
   *
   * @param parts - Componentes de la clave (tipos de activo, IDs, estilos, etc.).
   * @returns Clave de cache namespaceada y consistente.
   */
  protected buildCacheKey(parts: Array<string | number>): string {
    return `${this.config.serviceName}:${parts.join(':')}`;
  }

  /**
   * Helper de pausa asíncrona para el backoff entre reintentos.
   * @param ms - Milisegundos a esperar.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Crea una implementación de cache basada en localStorage.
   *
   * LIMITACIONES:
   *   - Solo disponible en cliente (window !== undefined).
   *   - En SSR (Next.js Server Components / Route Handlers) retorna
   *     un no-op cache que siempre devuelve null.
   *   - Para producción en servidor, inyectar un cliente Redis/Upstash via deps.
   *
   * IMPLEMENTACIÓN DEL TTL:
   *   Almacena `{ value, expiry }` donde `expiry` es el timestamp de expiración
   *   en ms. Al leer, compara `Date.now()` con `expiry` y elimina la entrada
   *   si está expirada, evitando que datos obsoletos se sirvan indefinidamente.
   */
  private createLocalStorageCache() {
    if (typeof window === 'undefined' || !window.localStorage) {
      // Entorno SSR: no-op cache para evitar errores en el servidor
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
            localStorage.removeItem(key); // Limpiar entrada expirada
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
          // Fallo silencioso: quota exceeded, modo privado, etc.
        }
      },
      delete: async (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Fallo silencioso
        }
      },
    };
  }
}
