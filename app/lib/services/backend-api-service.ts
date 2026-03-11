/**
 * @file backend-api-service.ts
 * @module app/lib/services/backend-api-service
 *
 * ============================================================
 * SERVICIO — CLIENTE HTTP PARA EL API REST DE LARAVEL (GIMA)
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `BackendAPIService`, el cliente HTTP centralizado que todas las
 *   chat tools de GIMA usan para consultar datos en tiempo real del backend
 *   Laravel. Encapsula autenticación, retry, timeout, validación de schema
 *   y unwrap de paginación en un único punto de responsabilidad.
 *
 *   También expone `createBackendAPIService`, una factory que construye
 *   una instancia configurada con el token del usuario actual extraído
 *   de las cookies de sesión.
 *
 * CONTEXTO EN GIMA:
 *   Las chat tools (getActivos, getMantenimientos, getRepuestos, etc.)
 *   son funciones que el LLM invoca durante el chat para responder preguntas
 *   con datos reales. Cada tool llama a un método de BackendAPIService,
 *   que se encarga de autenticar, paginar y validar la respuesta del backend.
 *
 *   El flujo es:
 *   [LLM invoca tool] → [tool llama BackendAPIService] → [Laravel API]
 *   → [validación Zod] → [PaginatedResult<T>] → [LLM genera respuesta]
 *
 * AUTENTICACIÓN (Laravel Sanctum):
 *   El token de sesión del usuario se inyecta por instancia (no global).
 *   Esto es crítico en Next.js donde múltiples usuarios pueden tener
 *   requests concurrentes: cada request crea su propia instancia con
 *   su propio token vía `createBackendAPIService`.
 *
 * TIMEOUT Y MARGEN DE VERCEL EDGE:
 *   Default 8s (vs el típico 30s). Las funciones de Vercel Edge tienen
 *   un límite de 15-25s según el plan. 8s deja margen para que el LLM
 *   procese la respuesta del tool y genere la respuesta final al usuario.
 *
 * RETRY LOGIC:
 *   2 reintentos (3 intentos total) con backoff exponencial base 1s.
 *   Solo se reintentan errores transitivos:
 *     - Timeouts (DOMException TimeoutError)
 *     - Errores 408, 429 y 5xx
 *   Se excluyen del retry:
 *     - 401 BackendAuthError (no recuperable, sesión expirada)
 *     - 400, 403, 404 (errores de datos o permisos, retry no ayuda)
 *
 * DEGRADACIÓN GRACEFUL EN requestPaginated:
 *   Si la respuesta del backend no cumple el schema Zod (ej. el backend
 *   evolutionó y añadió un campo requerido), en lugar de lanzar un error
 *   que rompa el chat, se loguea un warning y se hace fallback extrayendo
 *   `data` directamente del JSON crudo. El usuario recibe datos aunque
 *   no estén completamente tipados.
 *
 * ERRORES EXPORTADOS:
 *   - BackendAPIError     → Error HTTP genérico con statusCode y endpoint.
 *   - BackendTimeoutError → Request superó timeoutMs. Mensaje user-friendly.
 *   - BackendAuthError    → HTTP 401. Indica sesión expirada.
 *
 */

import { z } from 'zod';

import { env } from '@/app/config/env';
import { logger } from '@/app/lib/logger';
import {
  laravelPaginatedSchema,
  activoSchema,
  mantenimientoSchema,
  repuestoSchema,
  calendarioSchema,
  reporteSchema,
  proveedorSchema,
  type PaginatedResult,
  type Activo,
  type Mantenimiento,
  type Repuesto,
  type CalendarioMantenimiento,
  type Reporte,
  type Proveedor,
} from '@/app/lib/schemas/backend-response.schema';

import type {
  ActivosFiltros,
  MantenimientosFiltros,
  RepuestosFiltros,
  ReportesFiltros,
  CalendarioFiltros,
} from '@/app/lib/ai/tools/tool-types';

// ============================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================

/**
 * Configuración del cliente HTTP del backend.
 *
 * @property baseUrl       - URL base del backend Laravel (ej. https://api.gima.com).
 * @property token         - Bearer token de Laravel Sanctum del usuario actual.
 * @property timeoutMs     - Timeout por request en ms. Default 8s (margen Vercel Edge).
 * @property maxRetries    - Reintentos máximos en errores transitivos. Default 2.
 * @property backoffBaseMs - Base del backoff exponencial en ms. Default 1000ms.
 *                           Intento 1: 1s, Intento 2: 2s.
 */
export interface BackendAPIConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}

/**
 * Dependencias inyectables del servicio.
 *
 * @property fetchFn - Implementación de fetch. En tests se inyecta un mock
 *                     para verificar headers, URLs y bodies sin llamadas reales.
 */
export interface BackendAPIDeps {
  fetchFn: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 1000;

// ============================================================
// ERRORES PERSONALIZADOS
// ============================================================

/**
 * Error base para todos los errores del BackendAPIService.
 *
 * Extiende Error con `statusCode` (para distinguir tipos de error HTTP)
 * y `endpoint` (para identificar qué llamada falló en los logs).
 *
 * @property statusCode - Código HTTP de la respuesta (ej. 404, 500). Undefined si es error de red.
 * @property endpoint   - Path del endpoint que falló (ej. '/api/catalogo/activos').
 */
export class BackendAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string
  ) {
    super(message);
    this.name = 'BackendAPIError';
  }
}

/**
 * Error de timeout del backend.
 *
 * Se lanza cuando `AbortSignal.timeout(timeoutMs)` interrumpe el request.
 * El mensaje es user-friendly (en español) porque puede mostrarse directamente
 * en la respuesta del chat como sugerencia al usuario.
 *
 * @example Mensaje: "El servidor tardó más de 8s en responder. Intenta con filtros más específicos."
 */
export class BackendTimeoutError extends BackendAPIError {
  constructor(endpoint: string, timeoutMs: number) {
    super(
      `El servidor tardó más de ${Math.round(timeoutMs / 1000)}s en responder. Intenta con filtros más específicos.`,
      408,
      endpoint
    );
    this.name = 'BackendTimeoutError';
  }
}

/**
 * Error de autenticación con el backend.
 *
 * Se lanza ante HTTP 401. Indica que el token Sanctum del usuario ha expirado
 * o es inválido. No es recuperable con retry — el usuario debe re-autenticarse.
 * Se propaga sin reintentos para que la UI pueda redirigir al login.
 */
export class BackendAuthError extends BackendAPIError {
  constructor() {
    super('No se pudo autenticar con el backend. Verifica tu sesión.', 401);
    this.name = 'BackendAuthError';
  }
}

// ============================================================
// SERVICIO: BackendAPIService
// ============================================================

/**
 * Cliente HTTP para la API REST de Laravel con retry, timeout y validación Zod.
 *
 * @example
 * ```typescript
 * // En una chat tool:
 * const api = createBackendAPIService({ token: userToken });
 * const result = await api.getActivos({ estado: 'operativo', page: 1 });
 * // result.items: Activo[]
 * // result.pagination.total: number
 * ```
 */
export class BackendAPIService {
  private readonly config: Required<BackendAPIConfig>;
  private readonly deps: BackendAPIDeps;

  /**
   * @param config - Configuración del cliente. Solo `baseUrl` y `token` son obligatorios.
   * @param deps   - Dependencias inyectables. En producción usa el fetch global.
   */
  constructor(config: BackendAPIConfig, deps?: Partial<BackendAPIDeps>) {
    this.config = {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      backoffBaseMs: DEFAULT_BACKOFF_BASE_MS,
      ...config,
    };
    this.deps = {
      fetchFn: deps?.fetchFn ?? fetch,
    };
  }

  // ============================================================
  // MÉTODOS PRIVADOS — HTTP CORE
  // ============================================================

  /**
   * Ejecuta una petición HTTP autenticada con retry y timeout automáticos.
   *
   * QUÉ HACE:
   *   1. Loop de intentos (0 a maxRetries inclusive).
   *   2. En cada intento > 0: espera el backoff exponencial.
   *   3. Añade headers de autenticación y timeout via AbortSignal.
   *   4. Ante 401: lanza BackendAuthError inmediatamente (sin retry).
   *   5. Ante timeout DOMException: convierte a BackendTimeoutError.
   *   6. Ante errores 4xx (excepto 408/429): lanza sin retry.
   *   7. Ante errores transitorios: loguea warning y reintenta.
   *
   * @param endpoint - Path del endpoint (ej. '/api/catalogo/activos?page=1').
   * @param options  - Opciones de fetch (method, body, etc.). Los headers de
   *                   autenticación se añaden automáticamente.
   * @returns JSON de la respuesta parseado como T.
   * @throws BackendAuthError si el token es inválido (401).
   * @throws BackendTimeoutError si el request supera timeoutMs.
   * @throws BackendAPIError para cualquier otro error HTTP.
   */
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Backoff exponencial: 1s, 2s, 4s... según backoffBaseMs
          const delay = this.config.backoffBaseMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const response = await this.deps.fetchFn(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        // 401: sesión expirada → no reintentar, propagar directamente
        if (response.status === 401) {
          throw new BackendAuthError();
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new BackendAPIError(
            `Error ${response.status}: ${errorBody}`,
            response.status,
            endpoint
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof BackendAuthError) {
          throw error; // No recuperable — propagar inmediatamente
        }

        // DOMException TimeoutError → convertir a BackendTimeoutError con mensaje amigable
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          lastError = new BackendTimeoutError(endpoint, this.config.timeoutMs);
          if (attempt === this.config.maxRetries) throw lastError;
          continue; // Reintentar timeout
        }

        // Errores 4xx (excepto 408 Request Timeout y 429 Rate Limit) → no reintentar
        if (
          error instanceof BackendAPIError &&
          error.statusCode &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 408 &&
          error.statusCode !== 429
        ) {
          throw error;
        }

        logger.warn(`Backend request attempt ${attempt + 1} failed`, {
          component: 'BackendAPIService',
          action: 'request',
          endpoint,
          error: lastError.message,
        });
      }
    }

    throw lastError ?? new BackendAPIError('Request failed after retries', undefined, endpoint);
  }

  /**
   * Ejecuta una petición paginada con unwrap automático y degradación graceful.
   *
   * QUÉ HACE:
   *   1. Llama a `request` para obtener el JSON crudo.
   *   2. Aplica `laravelPaginatedSchema(schema)` para normalizar y validar.
   *   3. Si la validación falla (schema evolucionó): loguea warning y hace
   *      fallback extrayendo `data` directamente del JSON crudo.
   *   4. Retorna `PaginatedResult<T>` con el formato normalizado del frontend.
   *
   * POR QUÉ DEGRADACIÓN GRACEFUL EN LUGAR DE LANZAR:
   *   Una falla de schema en un tool del chat no debe romper la conversación.
   *   El usuario puede recibir datos aunque no estén completamente tipados.
   *   El error queda registrado para que el equipo lo detecte y corrija.
   *
   * @param endpoint - Path del endpoint paginado.
   * @param schema   - Schema Zod para validar cada ítem del array `data`.
   * @returns Resultado paginado normalizado al formato del frontend.
   */
  private async requestPaginated<T>(
    endpoint: string,
    schema: z.ZodType<T>
  ): Promise<PaginatedResult<T>> {
    const raw = await this.request<unknown>(endpoint);
    const paginatedSchema = laravelPaginatedSchema(schema);
    const result = paginatedSchema.safeParse(raw);

    if (!result.success) {
      logger.warn('Schema parse failed for paginated response, using raw data fallback', {
        component: 'BackendAPIService',
        action: 'requestPaginated',
        endpoint,
        // Solo los primeros 3 errores para no saturar los logs
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3),
      });

      // Fallback: extraer data del JSON crudo sin validación de tipos
      const obj = raw as Record<string, unknown>;
      const items = Array.isArray(obj.data) ? obj.data : [];
      return {
        items: items as T[],
        pagination: {
          page: Number(obj.current_page ?? 1),
          lastPage: Number(obj.last_page ?? 1),
          perPage: Number(obj.per_page ?? 15),
          total: Number(obj.total ?? 0),
          hasMore: false, // Conservador: sin schema válido no se puede determinar
        },
      };
    }

    const parsed = result.data;

    return {
      items: parsed.data as T[],
      pagination: {
        page: parsed.meta.current_page,
        lastPage: parsed.meta.last_page,
        perPage: parsed.meta.per_page,
        total: parsed.meta.total,
        // hasMore: true si links.next tiene URL (hay página siguiente)
        hasMore: parsed.links?.next !== null && parsed.links?.next !== undefined,
      },
    };
  }

  /**
   * Construye un query string desde un objeto de filtros.
   *
   * Omite valores `undefined`, `null` y string vacío para no enviar
   * parámetros sin valor al backend (evita filtros vacíos accidentales).
   *
   * @param params - Objeto de filtros donde las claves son nombres de query params.
   * @returns Query string con `?` inicial, o string vacío si no hay params.
   *
   * @example
   *   buildQuery({ estado: 'activo', page: 1, tipo: null })
   *   // → "?estado=activo&page=1"   (tipo=null se omite)
   */
  private buildQuery(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }

  // ============================================================
  // MÉTODOS PÚBLICOS — ENDPOINTS DEL BACKEND
  // ============================================================

  // -------------------------------------------
  // Catálogo de Activos
  // -------------------------------------------

  /**
   * Obtiene activos del catálogo con filtros opcionales.
   *
   * ROUTING ESPECIAL:
   *   Si el filtro `tipo` está presente, se usa el endpoint
   *   `/api/catalogo/activos/por-categoria` porque Laravel tiene
   *   un endpoint específico para filtrar por tipo de activo.
   *   Para otros filtros (estado, búsqueda, página) se usa el endpoint base.
   *
   * @param filtros - Filtros opcionales: estado, buscar, tipo, page.
   * @returns Activos paginados del catálogo.
   */
  async getActivos(filtros?: ActivosFiltros): Promise<PaginatedResult<Activo>> {
    const query = this.buildQuery({ ...filtros });

    if (filtros?.tipo) {
      return this.requestPaginated(`/api/catalogo/activos/por-categoria${query}`, activoSchema);
    }

    return this.requestPaginated(`/api/catalogo/activos${query}`, activoSchema);
  }

  // -------------------------------------------
  // Módulo de Mantenimiento
  // -------------------------------------------

  /**
   * Obtiene órdenes de mantenimiento con filtros opcionales.
   * @param filtros - Filtros: estado, tipo, sede_id, prioridad, page.
   */
  async getMantenimientos(
    filtros?: MantenimientosFiltros
  ): Promise<PaginatedResult<Mantenimiento>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/mantenimientos${query}`, mantenimientoSchema);
  }

  /**
   * Obtiene eventos del calendario de mantenimientos programados.
   * @param filtros - Filtros: page.
   */
  async getCalendario(
    filtros?: CalendarioFiltros
  ): Promise<PaginatedResult<CalendarioMantenimiento>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/calendario${query}`, calendarioSchema);
  }

  /**
   * Obtiene reportes de fallas o incidencias con filtros opcionales.
   * @param filtros - Filtros: prioridad, estado, page.
   */
  async getReportes(filtros?: ReportesFiltros): Promise<PaginatedResult<Reporte>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/reportes${query}`, reporteSchema);
  }

  // -------------------------------------------
  // Módulo de Inventario
  // -------------------------------------------

  /**
   * Obtiene repuestos del inventario con filtros opcionales.
   * @param filtros - Filtros: buscar, bajo_stock, proveedor_id, direccion_id, page.
   */
  async getRepuestos(filtros?: RepuestosFiltros): Promise<PaginatedResult<Repuesto>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/inventario/repuestos${query}`, repuestoSchema);
  }

  /**
   * Obtiene el listado completo de proveedores (sin filtros, sin paginación significativa).
   */
  async getProveedores(): Promise<PaginatedResult<Proveedor>> {
    return this.requestPaginated('/api/inventario/proveedores', proveedorSchema);
  }
}

// ============================================================
// FACTORY
// ============================================================

/**
 * Crea una instancia de BackendAPIService configurada con el token del usuario.
 *
 * CUÁNDO USAR ESTA FACTORY (no el constructor directamente):
 *   Siempre que el código se ejecute en el servidor (Server Actions, Route Handlers,
 *   tool execute functions). El token se extrae de las cookies de sesión del request
 *   actual y se inyecta en la instancia para aislar tokens entre usuarios concurrentes.
 *
 * @param params.token - Bearer token de Laravel Sanctum del usuario actual.
 * @param params.deps  - Dependencias inyectables opcionales (para tests).
 * @returns Instancia configurada con la URL del backend del entorno.
 * @throws BackendAPIError si `NEXT_PUBLIC_BACKEND_API_URL` no está configurada.
 *
 * @example
 * ```typescript
 * // En una chat tool execute function:
 * const cookieStore = await cookies();
 * const token = cookieStore.get('sanctum_token')?.value;
 * const api = createBackendAPIService({ token });
 * ```
 */
export function createBackendAPIService(params: {
  token: string;
  deps?: Partial<BackendAPIDeps>;
}): BackendAPIService {
  const baseUrl = env.NEXT_PUBLIC_BACKEND_API_URL;
  if (!baseUrl) {
    throw new BackendAPIError('NEXT_PUBLIC_BACKEND_API_URL no está configurada');
  }

  return new BackendAPIService({ baseUrl, token: params.token }, params.deps);
}
