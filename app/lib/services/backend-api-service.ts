/**
 * BackendAPIService — Cliente HTTP para la API REST de Laravel (GIMA)
 *
 * Características:
 * - Autenticación via Bearer token (Laravel Sanctum)
 * - Token inyectado por instancia (no global)
 * - Unwrap automático de paginación (LengthAwarePaginator)
 * - Timeout configurable (8s default, margen para Vercel Edge)
 * - Retry con backoff exponencial (2 reintentos)
 * - Manejo de errores tipado
 *
 * @see docs/backend/api.php para la lista completa de endpoints
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
  categoriaActivosSchema,
  type PaginatedResult,
  type Activo,
  type Mantenimiento,
  type Repuesto,
  type CalendarioMantenimiento,
  type Reporte,
  type Proveedor,
  type CategoriaActivos,
} from '@/app/lib/schemas/backend-response.schema';

import type {
  ActivosFiltros,
  MantenimientosFiltros,
  RepuestosFiltros,
  ReportesFiltros,
  CalendarioFiltros,
} from '@/app/lib/ai/tools/tool-types';

// ===========================================
// Configuration & Types
// ===========================================

export interface BackendAPIConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}

export interface BackendAPIDeps {
  fetchFn: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 1000;

// ===========================================
// Custom Errors
// ===========================================

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

export class BackendAuthError extends BackendAPIError {
  constructor() {
    super('No se pudo autenticar con el backend. Verifica tu sesión.', 401);
    this.name = 'BackendAuthError';
  }
}

// ===========================================
// Service
// ===========================================

export class BackendAPIService {
  private readonly config: Required<BackendAPIConfig>;
  private readonly deps: BackendAPIDeps;

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

  // -------------------------------------------
  // Core HTTP
  // -------------------------------------------

  /**
   * Ejecuta una petición HTTP con retry y timeout
   */
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
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

        // No retry on auth errors
        if (error instanceof BackendAuthError) {
          throw error;
        }

        // Timeout: wrap in custom error
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          lastError = new BackendTimeoutError(endpoint, this.config.timeoutMs);
          if (attempt === this.config.maxRetries) throw lastError;
          continue;
        }

        // Non-retryable HTTP errors (4xx except 408/429)
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
   * Petición con unwrap automático de paginación Laravel
   */
  private async requestPaginated<T>(
    endpoint: string,
    schema: z.ZodType<T>
  ): Promise<PaginatedResult<T>> {
    const raw = await this.request<unknown>(endpoint);
    const paginatedSchema = laravelPaginatedSchema(schema);
    const parsed = paginatedSchema.parse(raw);

    return {
      items: parsed.data as T[],
      pagination: {
        page: parsed.current_page,
        lastPage: parsed.last_page,
        perPage: parsed.per_page,
        total: parsed.total,
        hasMore: parsed.next_page_url !== null,
      },
    };
  }

  /**
   * Construye query string desde filtros, ignorando undefined/null
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

  // -------------------------------------------
  // Catálogo
  // -------------------------------------------

  async getActivos(filtros?: ActivosFiltros): Promise<PaginatedResult<Activo>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/catalogo/activos${query}`, activoSchema);
  }

  async getActivosPorCategoria(): Promise<CategoriaActivos[]> {
    const raw = await this.request<unknown>('/api/catalogo/activos/por-categoria');
    return z.array(categoriaActivosSchema).parse(raw);
  }

  // -------------------------------------------
  // Mantenimiento
  // -------------------------------------------

  async getMantenimientos(
    filtros?: MantenimientosFiltros
  ): Promise<PaginatedResult<Mantenimiento>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/mantenimientos${query}`, mantenimientoSchema);
  }

  async getCalendario(
    filtros?: CalendarioFiltros
  ): Promise<PaginatedResult<CalendarioMantenimiento>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/calendario${query}`, calendarioSchema);
  }

  async getReportes(filtros?: ReportesFiltros): Promise<PaginatedResult<Reporte>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/mantenimiento/reportes${query}`, reporteSchema);
  }

  // -------------------------------------------
  // Inventario
  // -------------------------------------------

  async getRepuestos(filtros?: RepuestosFiltros): Promise<PaginatedResult<Repuesto>> {
    const query = this.buildQuery({ ...filtros });
    return this.requestPaginated(`/api/inventario/repuestos${query}`, repuestoSchema);
  }

  async getProveedores(): Promise<PaginatedResult<Proveedor>> {
    return this.requestPaginated('/api/inventario/proveedores', proveedorSchema);
  }
}

// ===========================================
// Factory
// ===========================================

/**
 * Crea una instancia de BackendAPIService con el token de sesión del usuario.
 * Se usa dentro de las tool execute functions con el token extraído de cookies().
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
