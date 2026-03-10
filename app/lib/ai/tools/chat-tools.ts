import { tool, stepCountIs } from 'ai';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { logger } from '@/app/lib/logger';
import {
  createBackendAPIService,
  BackendTimeoutError,
  BackendAuthError,
  BackendAPIError,
} from '@/app/lib/services/backend-api-service';
import { ChecklistAIService } from '@/app/lib/services/checklist-ai-service';
import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';

import type { ToolErrorResult } from './tool-types';

// ===========================================
// Constants
// ===========================================

/**
 * Máximo de items que se envían al LLM por respuesta de tool.
 * Mitiga el error de TPM (tokens-per-minute) en modelos con límites bajos
 * como llama-3.1-8b-instant (6000 TPM). Con más de ~15 items el contexto
 * acumulado en multi-step supera el límite fácilmente.
 */
const MAX_ITEMS_PER_RESPONSE = 15;

/**
 * Máximo de caracteres para campos de descripción en respuestas.
 * Evita que descripciones largas saturen el contexto del modelo.
 */
const MAX_DESCRIPTION_LENGTH = 120;

// ===========================================
// Helpers
// ===========================================

function stripNulls(val: unknown): Record<string, unknown> {
  if (!val || typeof val !== 'object') return {};
  const obj = val as Record<string, unknown>;
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * Trunca un string al límite indicado para reducir tokens en respuestas al LLM.
 */
function truncate(
  str: string | null | undefined,
  limit = MAX_DESCRIPTION_LENGTH
): string | undefined {
  if (!str) return undefined;
  return str.length > limit ? str.slice(0, limit) + '…' : str;
}

/**
 * Normaliza el tipo de activo enviado por el LLM a los valores canónicos.
 *
 * FIX ERROR 1: El LLM envía variantes naturales como "hvac", "ac", "aire
 * acondicionado", "electrico" que no coinciden exactamente con los valores
 * del enum ("unidad-hvac", "panel-electrico", etc.). El preprocess anterior
 * descartaba silenciosamente estos valores → undefined → Zod lanzaba:
 *   "Invalid input: expected string, received undefined"
 *
 * Solución: mapa de alias exhaustivo que normaliza variantes comunes al valor
 * canónico antes de que safeEnum evalúe el resultado.
 */
const ASSET_TYPE_VALUES = [
  'unidad-hvac',
  'caldera',
  'bomba',
  'compresor',
  'generador',
  'panel-electrico',
  'transportador',
  'grua',
  'montacargas',
  'otro',
] as const;

type AssetType = (typeof ASSET_TYPE_VALUES)[number];

const ASSET_TYPE_ALIASES: Record<string, AssetType> = {
  // HVAC / Aire acondicionado
  hvac: 'unidad-hvac',
  ac: 'unidad-hvac',
  'aire-acondicionado': 'unidad-hvac',
  'aire acondicionado': 'unidad-hvac',
  'unidad hvac': 'unidad-hvac',
  split: 'unidad-hvac',
  chiller: 'unidad-hvac',
  'fan-coil': 'unidad-hvac',
  fancoil: 'unidad-hvac',
  minisplit: 'unidad-hvac',
  // Eléctrico
  electrico: 'panel-electrico',
  'panel electrico': 'panel-electrico',
  'tablero electrico': 'panel-electrico',
  tablero: 'panel-electrico',
  mcc: 'panel-electrico',
  // Bombas
  pump: 'bomba',
  // Compresores
  compressor: 'compresor',
  // Generadores
  generator: 'generador',
  planta: 'generador',
  'planta electrica': 'generador',
  'planta eléctrica': 'generador',
  // Grúas / Transporte
  crane: 'grua',
  conveyor: 'transportador',
  forklift: 'montacargas',
  // Calderas
  boiler: 'caldera',
  // Genérico
  general: 'otro',
  other: 'otro',
  equipo: 'otro',
};

function normalizeAssetType(val: unknown): unknown {
  const raw = Array.isArray(val) ? val[0] : val;
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string') return raw;

  const normalized = raw.trim().toLowerCase();

  // Valor ya canónico → devolver tal cual (preservando el case original si el enum lo requiere)
  if ((ASSET_TYPE_VALUES as readonly string[]).includes(normalized)) return normalized;

  // Coincidencia exacta en el mapa de alias
  const mapped = ASSET_TYPE_ALIASES[normalized];
  if (mapped) return mapped;

  // Búsqueda parcial: si el string contiene algún alias conocido
  for (const [alias, canonical] of Object.entries(ASSET_TYPE_ALIASES)) {
    if (normalized.includes(alias)) return canonical;
  }

  // Sin match → undefined; el execute usará el fallback 'otro'
  return undefined;
}

/**
 * Campo opcional con valores sugeridos vía .describe().
 * Silencia valores inválidos → undefined en lugar de lanzar error de schema.
 *
 * FIX #8 (prev): Eliminada la inner .optional() redundante que generaba
 * anyOf innecesario en el JSON Schema enviado al Anthropic API.
 */
function safeEnum<T extends string>(allowedValues: readonly [T, ...T[]]) {
  return z
    .preprocess(
      (val) => {
        const raw = Array.isArray(val) ? val[0] : val;
        if (raw === null || raw === undefined || raw === '') return undefined;
        if (typeof raw === 'string' && (allowedValues as readonly string[]).includes(raw)) {
          return raw;
        }
        return undefined;
      },
      z.string().describe(`Valores permitidos: ${allowedValues.join(' | ')}`)
    )
    .optional();
}

/**
 * Valida un valor contra una lista de permitidos.
 * Retorna el valor si coincide, o undefined si no.
 * Se usa dentro de execute() para normalizar valores enviados por el LLM.
 *
 * FIX: `safeEnum` con z.preprocess() genera un JSON Schema incompatible con Groq
 * (el LLM rechazaba valores no-enum ANTES de llegar a Zod).
 * Esta función valida en execute() en lugar de en el schema.
 */
function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const str = String(value).trim().toLowerCase();
  return (allowedValues as readonly string[]).includes(str) ? (str as T) : undefined;
}

/**
 * Normaliza respuestas paginadas del backend, tolerando las variantes de Laravel:
 *   - Resource con { data[], links: object, meta: object }
 *   - Simple con { data[], current_page, total, ... }
 *   - Wrapper interno con { items[], pagination: object }
 *   - links como array (algunos endpoints de Laravel Paginator)  ← FIX #7 prev
 */
function normalizePaginatedResponse(raw: unknown): {
  items: unknown[];
  pagination: { page: number; perPage: number; total: number; lastPage: number };
} {
  if (!raw || typeof raw !== 'object') {
    return { items: [], pagination: { page: 1, perPage: 15, total: 0, lastPage: 1 } };
  }

  const r = raw as Record<string, unknown>;

  // Wrapper interno { items, pagination }
  if (r.pagination && typeof r.pagination === 'object' && !Array.isArray(r.pagination)) {
    const p = r.pagination as Record<string, unknown>;
    return {
      items: Array.isArray(r.items) ? r.items : [],
      pagination: {
        page: Number(p.page ?? 1),
        perPage: Number(p.perPage ?? 15),
        total: Number(p.total ?? 0),
        lastPage: Number(p.lastPage ?? 1),
      },
    };
  }

  const items = Array.isArray(r.data) ? r.data : Array.isArray(r.items) ? r.items : [];

  // meta solo se usa si es un objeto plano (no array, no undefined/null)
  const hasObjectMeta =
    r.meta !== undefined && r.meta !== null && typeof r.meta === 'object' && !Array.isArray(r.meta);

  if (hasObjectMeta) {
    const meta = r.meta as Record<string, unknown>;
    return {
      items,
      pagination: {
        page: Number(meta.current_page ?? 1),
        perPage: Number(meta.per_page ?? 15),
        total: Number(meta.total ?? 0),
        lastPage: Number(meta.last_page ?? 1),
      },
    };
  }

  // Fallback: campos planos en la raíz (Laravel sin Resource wrapper)
  return {
    items,
    pagination: {
      page: Number(r.current_page ?? r.page ?? 1),
      perPage: Number(r.per_page ?? 15),
      total: Number(r.total ?? 0),
      lastPage: Number(r.last_page ?? 1),
    },
  };
}

async function getAuthenticatedAPI() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new BackendAuthError();
  return createBackendAPIService({ token });
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof BackendTimeoutError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('connect timeout') ||
      msg.includes('etimedout') ||
      msg.includes('econnaborted')
    );
  }
  return false;
}

/**
 * FIX #10 (prev): Mejorado manejo de errores no-Error.
 * JSON.stringify para objetos no-Error evita '[object Object]' en logs.
 */
async function safeExecute<T>(
  toolName: string,
  fn: () => Promise<T>
): Promise<T | ToolErrorResult> {
  try {
    return await fn();
  } catch (error) {
    logger.error(
      `Tool ${toolName} failed`,
      error instanceof Error ? error : new Error(String(error)),
      { component: 'chatTools', action: toolName }
    );

    if (error instanceof BackendAuthError) {
      return {
        success: false,
        error: 'No se pudo autenticar. Inicia sesión nuevamente.',
        suggestion: 'Recarga la página e inicia sesión.',
      };
    }

    if (isTimeoutError(error)) {
      return {
        success: false,
        error: 'El servicio tardó demasiado en responder. Intenta de nuevo.',
        suggestion: 'Intenta con filtros más específicos.',
      };
    }

    if (error instanceof BackendAPIError) {
      return {
        success: false,
        error: `Error del servidor: ${error.message}`,
        suggestion: 'Verifica que el backend esté disponible.',
      };
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error)
          : String(error);

    return { success: false, error: errorMessage };
  }
}

// ===========================================
// Tool Definitions
// ===========================================

export const chatTools = {
  // ─────────────────────────────────────────
  // Catálogo
  // ─────────────────────────────────────────

  consultar_activos: tool({
    description:
      'Consulta, lista o busca activos/equipos registrados por nombre, código, estado o ubicación. ' +
      'NO la uses si el usuario solo menciona un activo sin pedir una consulta explícita. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        estado: safeEnum(['operativo', 'mantenimiento', 'fuera_servicio', 'baja']),
        buscar: z.string().optional(),
        // FIX #9 (prev): tipo era enum ['mobiliario','equipo'] que no existe en la API.
        // ArticuloResource.tipo es string libre ("Bomba de Agua", etc.).
        tipo: z
          .string()
          .optional()
          .describe('Tipo de activo en texto libre, ej: "bomba", "compresor", "mobiliario"'),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_activos', async () => {
        const api = await getAuthenticatedAPI();
        // Validar enum en execute para evitar schema rejection por el LLM
        const estado = validateEnum(params.estado, [
          'operativo',
          'mantenimiento',
          'fuera_servicio',
          'baja',
        ] as const);
        const raw = await api.getActivos({ ...params, estado });
        const result = normalizePaginatedResponse(raw);
        // FIX ERROR 2: Limitar items para evitar TPM overflow
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);
        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              codigo: item.codigo,
              estado: item.estado,
              valor: item.valor,
              articulo: {
                tipo: item.articulo?.tipo,
                descripcion: truncate(item.articulo?.descripcion),
                modelo: item.articulo?.modelo,
                marca: item.articulo?.marca,
              },
              ubicacion: {
                edificio: item.ubicacion?.edificio,
                piso: item.ubicacion?.piso,
                salon: item.ubicacion?.salon,
              },
            })),
            pagination: result.pagination,
            note:
              result.items.length > MAX_ITEMS_PER_RESPONSE
                ? `Mostrando ${MAX_ITEMS_PER_RESPONSE} de ${result.pagination.total}. Usa page o filtros para ver más.`
                : undefined,
          },
          summary: `Se encontraron ${result.pagination.total} activos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // Mantenimiento
  // ─────────────────────────────────────────

  consultar_mantenimientos: tool({
    description:
      'Consulta órdenes de mantenimiento. Úsala cuando pregunten por mantenimientos pendientes, ' +
      'en progreso, historial o por tipo. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        estado: safeEnum(['pendiente', 'en_progreso', 'completado', 'cancelado']),
        tipo: safeEnum(['preventivo', 'correctivo', 'predictivo']),
        prioridad: safeEnum(['baja', 'media', 'alta']),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_mantenimientos', async () => {
        const api = await getAuthenticatedAPI();
        const estado = validateEnum(params.estado, [
          'pendiente',
          'en_progreso',
          'completado',
          'cancelado',
        ] as const);
        const tipo = validateEnum(params.tipo, ['preventivo', 'correctivo', 'predictivo'] as const);
        const prioridad = validateEnum(params.prioridad, ['baja', 'media', 'alta'] as const);
        const raw = await api.getMantenimientos({ ...params, estado, tipo, prioridad });
        const result = normalizePaginatedResponse(raw);
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);
        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              descripcion: item.descripcion || truncate(item.reporte?.descripcion),
              prioridad: item.prioridad || item.reporte?.prioridad,
              estado: item.estado,
              tipo: item.tipo,
              fecha_apertura: item.fecha_apertura,
              fecha_cierre: item.fecha_cierre,
              costo_total: item.costo_total,
              validado: item.validado,
              reporte: {
                prioridad: item.reporte?.prioridad,
                // FIX #4 (prev): 'descripcion', no 'titulo'
                descripcion: truncate(item.reporte?.descripcion),
              },
              activo: {
                codigo: item.activo?.codigo,
                articulo: { descripcion: truncate(item.activo?.articulo?.descripcion) },
              },
            })),
            pagination: result.pagination,
            note:
              result.items.length > MAX_ITEMS_PER_RESPONSE
                ? `Mostrando ${MAX_ITEMS_PER_RESPONSE} de ${result.pagination.total}. Usa page o filtros.`
                : undefined,
          },
          summary: `Se encontraron ${result.pagination.total} mantenimientos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_calendario: tool({
    description:
      'Consulta el calendario de mantenimientos programados, próximos o agenda. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_calendario', async () => {
        const api = await getAuthenticatedAPI();
        const raw = await api.getCalendario(params);
        const result = normalizePaginatedResponse(raw);
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);
        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              fecha_programada: item.fecha_programada,
              estado: item.estado,
              tipo: item.tipo,
              activo: {
                codigo: item.activo?.codigo,
                articulo: { descripcion: truncate(item.activo?.articulo?.descripcion) },
              },
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} entradas en el calendario (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_reportes: tool({
    description:
      'Consulta reportes de mantenimiento, fallos, incidencias o problemas registrados. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        prioridad: safeEnum(['baja', 'media', 'alta']),
        estado: safeEnum(['abierto', 'asignado', 'en_progreso', 'resuelto', 'cerrado']),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_reportes', async () => {
        const api = await getAuthenticatedAPI();
        const prioridad = validateEnum(params.prioridad, ['baja', 'media', 'alta'] as const);
        const estado = validateEnum(params.estado, [
          'abierto',
          'asignado',
          'en_progreso',
          'resuelto',
          'cerrado',
        ] as const);
        const raw = await api.getReportes({ ...params, prioridad, estado });
        const result = normalizePaginatedResponse(raw);
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);
        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              // FIX #3 (prev): 'descripcion' y 'created_at', no 'titulo' ni 'fecha_reporte'
              descripcion: truncate(item.descripcion),
              estado: item.estado,
              prioridad: item.prioridad,
              created_at: item.created_at,
              activo: item.activo
                ? {
                    codigo: item.activo.codigo,
                    articulo: { descripcion: truncate(item.activo.articulo?.descripcion) },
                  }
                : undefined,
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} reportes (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // Inventario
  // ─────────────────────────────────────────

  consultar_inventario: tool({
    description:
      'Busca repuestos en el inventario por nombre o stock disponible. ' +
      'Para bajo stock usa bajo_stock:true. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        buscar: z.string().optional(),
        bajo_stock: z.boolean().optional(),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_inventario', async () => {
        const api = await getAuthenticatedAPI();
        const raw = await api.getRepuestos(params);
        const result = normalizePaginatedResponse(raw);
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);
        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              // FIX #1 (prev): campos directos en RepuestoResource, no bajo item.articulo
              nombre: item.nombre,
              codigo: item.codigo,
              descripcion: truncate(item.descripcion),
              stock: item.stock,
              stock_minimo: item.stock_minimo,
              costo: item.costo,
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} repuestos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_proveedores: tool({
    description:
      'Lista los proveedores registrados y sus contactos de suministro. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(stripNulls, z.object({})),
    execute: async () => {
      return safeExecute('consultar_proveedores', async () => {
        const api = await getAuthenticatedAPI();
        const raw = await api.getProveedores();
        const result = normalizePaginatedResponse(raw);
        return {
          success: true as const,
          data: {
            items: result.items.map((item: any) => ({
              id: item.id,
              nombre: item.nombre,
              // FIX #2 (prev): 'contacto', no 'contacto_principal'
              contacto: item.contacto,
              telefono: item.telefono,
              email: item.email,
              repuestos_count: item.repuestos_count,
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} proveedores`,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // AI Tools
  // ─────────────────────────────────────────

  generar_checklist: tool({
    description:
      'Genera un checklist de mantenimiento con IA para un activo y tipo de tarea. ' +
      'Tipos de activo: unidad-hvac, caldera, bomba, compresor, generador, panel-electrico, ' +
      'transportador, grua, montacargas, otro. ' +
      'También acepta alias como: hvac, ac, electrico, split, boiler, pump, etc. ' +
      'Esta herramienta es autosuficiente; NO invoques otras tools en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        // FIX ERROR 1: normalizeAssetType mapea aliases ("hvac" → "unidad-hvac", etc.)
        // antes de que safeEnum evalúe el valor. Sin esto el schema lanzaba:
        // "Invalid input: expected string, received undefined"
        assetType: z
          .preprocess(
            normalizeAssetType,
            z.string().describe(`Valores permitidos: ${ASSET_TYPE_VALUES.join(' | ')}`)
          )
          .optional(),
        taskType: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['preventivo', 'correctivo', 'predictivo'])
          )
          .optional()
          .default('preventivo'),
        customInstructions: z.string().optional(),
      })
    ),
    execute: async (params) => {
      return safeExecute('generar_checklist', async () => {
        const service = new ChecklistAIService();
        const result = await service.generateChecklist({
          assetType: (params.assetType ?? 'otro') as any,
          taskType: params.taskType as any,
          customInstructions: params.customInstructions,
        });

        if (!result.success || !result.checklist) {
          return {
            success: false as const,
            error: result.error || 'No se pudo generar el checklist',
          };
        }
        return {
          success: true as const,
          checklist: result.checklist,
          cached: result.cached ?? false,
          summary: `Checklist generado: "${result.checklist.title}" con ${result.checklist.items.length} items`,
        };
      });
    },
  }),

  generar_resumen_actividad: tool({
    description:
      'Genera un resumen profesional de notas de actividad con IA. ' +
      'Úsala para resumir actividades técnicas o crear informes de trabajo. ' +
      'Tipos de activo: unidad-hvac, caldera, bomba, compresor, generador, panel-electrico, ' +
      'transportador, grua, montacargas, otro. ' +
      'También acepta alias como: hvac, ac, electrico, split, etc. ' +
      'Esta herramienta es autosuficiente; NO invoques otras tools en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        // FIX ERROR 3 (regresión): Se restaura el preprocess en activities.
        // La versión anterior quitó el preprocess y dejó .min(10) desnudo → inputs
        // cortos como "Test" fallaban validación antes de llegar al execute, causando
        // el error "Failed to call a function" en el Anthropic API.
        // Ahora: inputs cortos o vacíos se normalizan a un string semántico válido
        // en lugar del grotesco padEnd(10, '.') original ("Test......").
        activities: z.preprocess((val) => {
          if (typeof val !== 'string') return 'Sin actividades registradas.';
          const trimmed = val.trim();
          if (trimmed.length === 0) return 'Sin actividades registradas.';
          if (trimmed.length < 10) return `Actividad reportada: ${trimmed}`;
          return trimmed;
        }, z.string().min(1).default('Sin actividades registradas.')),
        // FIX ERROR 1: mismo normalizeAssetType que en generar_checklist
        assetType: z
          .preprocess(
            normalizeAssetType,
            z.string().describe(`Valores permitidos: ${ASSET_TYPE_VALUES.join(' | ')}`)
          )
          .optional(),
        taskType: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['preventivo', 'correctivo', 'predictivo'])
          )
          .optional()
          .default('preventivo'),
        style: z
          .preprocess(
            (val) => {
              const raw = Array.isArray(val) ? val[0] : val;
              const map: Record<string, string> = {
                formal: 'ejecutivo',
                technical: 'tecnico',
                brief: 'narrativo',
              };
              return typeof raw === 'string' && map[raw] ? map[raw] : raw;
            },
            z.enum(['ejecutivo', 'tecnico', 'narrativo'])
          )
          .optional()
          .default('tecnico'),
        detailLevel: z
          .preprocess(
            (val) => {
              const raw = Array.isArray(val) ? val[0] : val;
              const map: Record<string, string> = {
                low: 'bajo',
                medium: 'medio',
                high: 'alto',
              };
              return typeof raw === 'string' && map[raw] ? map[raw] : raw;
            },
            z.enum(['alto', 'medio', 'bajo'])
          )
          .optional()
          .default('medio'),
      })
    ),
    execute: async (params) => {
      return safeExecute('generar_resumen_actividad', async () => {
        const service = new ActivitySummaryAIService();
        const result = await service.generateSummary({
          activities: params.activities,
          assetType: (params.assetType ?? 'otro') as any,
          taskType: params.taskType as any,
          style: params.style as any,
          detailLevel: params.detailLevel as any,
        });

        if (!result.success || !result.summary) {
          return {
            success: false as const,
            error: result.error || 'No se pudo generar el resumen',
          };
        }
        return {
          success: true as const,
          summary: result.summary,
          cached: result.cached ?? false,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // Acciones
  // ─────────────────────────────────────────

  crear_orden_trabajo: tool({
    description:
      'Crea una orden de trabajo en GIMA. SOLO cuando el usuario lo pida explícitamente. ' +
      'La descripción debe ser concisa (máx 500 caracteres); si el texto es más largo, resúmelo ANTES de llamar. ' +
      'location_text es el nombre del lugar en texto libre, NUNCA un ID numérico.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        equipment: z.string().default('Sin especificar'),
        description: z.preprocess(
          (val) => (typeof val === 'string' && val.length > 500 ? val.slice(0, 500) : (val ?? '')),
          z.string().max(500).default('')
        ),
        // FIX #5 (prev): .default('media') garantiza valor cuando priority es null/undefined
        priority: safeEnum(['baja', 'media', 'alta']).default('media'),
        location_text: z.string().optional(),
      })
    ),
    // No execute — client-side tool. El cliente renderiza OrderApprovalCard.
    // NOTA: executeWorkOrder debe leer `location_text` (string libre) en lugar
    // de `location`, y NO enviarlo como `direccion_id` al backend.
  }),
};

export const TOOL_STOP_CONDITION = stepCountIs(4);
export type ChatTools = typeof chatTools;
