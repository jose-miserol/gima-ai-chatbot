/**
 * Chat Tools — Definiciones de herramientas para el chatbot GIMA
 *
 * Usa AI SDK v5 con:
 * - `tool()` + `inputSchema` (no 'parameters')
 * - `stopWhen: stepCountIs(N)` para multi-step
 * - `needsApproval: true` para tools de mutación
 * - `cookies()` de Next.js para propagación del token Sanctum
 */

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
// Helpers
// ===========================================

/**
 * Strips ALL null values from params object before Zod validation.
 *
 * WHY: The LLM (Groq) sends `null` for unused optional fields.
 * The AI SDK validates against JSON Schema BEFORE our Zod runs.
 * By stripping nulls at the outermost preprocess, no field ever sees `null`.
 */
function stripNulls(val: unknown): Record<string, unknown> {
  if (!val || typeof val !== 'object') return {};
  const obj = val as Record<string, unknown>;
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * Creates a z.preprocess that silently drops values not in the allowed enum list.
 * Invalid values become `undefined`, making the optional field omitted from the query.
 */
function safeEnum<T extends string>(allowedValues: readonly [T, ...T[]]) {
  return z
    .preprocess((val) => {
      const raw = Array.isArray(val) ? val[0] : val;
      if (raw === null || raw === undefined || raw === '') return undefined;
      if (typeof raw === 'string' && (allowedValues as readonly string[]).includes(raw)) {
        return raw;
      }
      return undefined;
    }, z.enum(allowedValues).nullable().optional())
    .optional();
}

async function getAuthenticatedAPI() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    throw new BackendAuthError();
  }

  return createBackendAPIService({ token });
}

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

    if (error instanceof BackendTimeoutError) {
      return {
        success: false,
        error: error.message,
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

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// ===========================================
// Tool Definitions
// ===========================================

export const chatTools = {
  // -------------------------------------------
  // Catálogo
  // -------------------------------------------

  /**
   * FIX: Descripción acortada (~70% menos tokens) y más restrictiva.
   * Antes: disparaba ante cualquier mención de "activo" o "equipo".
   * Ahora: requiere intención explícita de consultar/listar activos.
   */
  consultar_activos: tool({
    description:
      'Usa esta herramienta SOLO cuando el usuario quiera consultar, listar o buscar activos/equipos registrados en GIMA (por nombre, código, estado u ubicación). NO la uses si el usuario solo menciona un activo de pasada sin pedir una consulta explícita.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        estado: safeEnum(['operativo', 'mantenimiento', 'fuera_servicio', 'baja']),
        buscar: z.string().optional(),
        tipo: safeEnum(['mobiliario', 'equipo']),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_activos', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getActivos(params);
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              codigo: item.codigo,
              estado: item.estado,
              articulo: {
                descripcion: item.articulo?.descripcion,
                modelo: item.articulo?.modelo,
                tipo: item.articulo?.tipo,
              },
              ubicacion: {
                edificio: item.ubicacion?.edificio,
                salon: item.ubicacion?.salon,
              },
            })),
          },
          summary: `Se encontraron ${result.pagination.total} activos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  // -------------------------------------------
  // Mantenimiento
  // -------------------------------------------

  consultar_mantenimientos: tool({
    description:
      'Consulta órdenes de mantenimiento. Úsala cuando pregunten por mantenimientos pendientes, en progreso, historial o por tipo (preventivo/correctivo/predictivo).',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        estado: safeEnum(['pendiente', 'en_progreso', 'completado', 'cancelado']),
        tipo: safeEnum(['preventivo', 'correctivo', 'predictivo']),
        sede_id: z.string().optional(),
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
        const result = await api.getMantenimientos(params);
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              estado: item.estado,
              tipo: item.tipo,
              fecha_apertura: item.fecha_apertura,
              fecha_cierre: item.fecha_cierre,
              costo_total: item.costo_total,
              validado: item.validado,
              reporte: {
                prioridad: item.reporte?.prioridad,
                titulo: item.reporte?.titulo,
              },
              activo: {
                codigo: item.activo?.codigo,
                articulo: { descripcion: item.activo?.articulo?.descripcion },
              },
            })),
          },
          summary: `Se encontraron ${result.pagination.total} mantenimientos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_calendario: tool({
    description:
      'Consulta el calendario de mantenimientos programados. Úsala para mantenimientos próximos, programaciones o agenda.',
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
        const result = await api.getCalendario(params);
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              fecha_programada: item.fecha_programada,
              estado: item.estado,
              tipo: item.tipo,
              activo: {
                codigo: item.activo?.codigo,
                articulo: { descripcion: item.activo?.articulo?.descripcion },
              },
            })),
          },
          summary: `Se encontraron ${result.pagination.total} entradas en el calendario (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_reportes: tool({
    description:
      'Consulta reportes de mantenimiento. Úsala cuando pregunten por reportes, fallos, incidencias o problemas registrados.',
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
        const result = await api.getReportes(params);
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              titulo: item.titulo,
              estado: item.estado,
              prioridad: item.prioridad,
              fecha_reporte: item.fecha_reporte,
              activo: {
                codigo: item.activo?.codigo,
                articulo: { descripcion: item.activo?.articulo?.descripcion },
              },
            })),
          },
          summary: `Se encontraron ${result.pagination.total} reportes (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  // -------------------------------------------
  // Inventario
  // -------------------------------------------

  consultar_inventario: tool({
    description:
      'Busca repuestos en el inventario. Úsala cuando pregunten por piezas, repuestos, stock disponible o alertas de bajo stock.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        buscar: z.string().optional(),
        bajo_stock: z.boolean().optional(),
        proveedor_id: z.string().optional(),
        direccion_id: z.string().optional(),
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_inventario', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getRepuestos(params);
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              stock: item.stock,
              stock_minimo: item.stock_minimo,
              articulo: {
                codigo: item.articulo?.codigo,
                descripcion: item.articulo?.descripcion,
              },
              almacen: { nombre: item.almacen?.nombre },
            })),
          },
          summary: `Se encontraron ${result.pagination.total} repuestos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_proveedores: tool({
    description:
      'Lista los proveedores registrados. Úsala cuando pregunten por proveedores o contactos de suministro.',
    inputSchema: z.preprocess(stripNulls, z.object({})),
    execute: async () => {
      return safeExecute('consultar_proveedores', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getProveedores();
        return {
          success: true as const,
          data: {
            ...result,
            items: result.items.map((item: any) => ({
              id: item.id,
              nombre: item.nombre,
              estado: item.estado,
              contacto_principal: item.contacto_principal,
            })),
          },
          summary: `Se encontraron ${result.pagination.total} proveedores`,
        };
      });
    },
  }),

  // -------------------------------------------
  // Generación con IA
  // -------------------------------------------

  generar_checklist: tool({
    description:
      'Genera un checklist de mantenimiento con IA. Úsala cuando pidan crear o sugerir un checklist para un tipo de activo y tarea. Tipos de activo sugeridos: hvac, bomba, caldera, tablero, generador, compresor, motor, transformador. Si el usuario menciona otro tipo, mapéalo al más cercano.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        assetType: z.string().default('hvac'),
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
          assetType: params.assetType as any,
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
      'Genera un resumen profesional de notas de actividad con IA. Úsala cuando pidan resumir actividades técnicas o crear un informe de trabajo. Tipos de activo sugeridos: hvac, bomba, caldera, tablero, generador, compresor, motor, transformador. Si el usuario menciona otro tipo (ej: "Test de Aire"), usa el valor más cercano (ej: "hvac") o escribe el tipo tal cual.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        activities: z.string().default(''),
        assetType: z.string().optional().default('general'),
        taskType: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['preventivo', 'correctivo', 'predictivo'])
          )
          .optional()
          .default('preventivo'),
        style: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['formal', 'technical', 'brief'])
          )
          .optional()
          .default('technical'),
        detailLevel: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['low', 'medium', 'high'])
          )
          .optional()
          .default('medium'),
      })
    ),
    execute: async (params) => {
      return safeExecute('generar_resumen_actividad', async () => {
        const service = new ActivitySummaryAIService();
        const result = await service.generateSummary({
          activities: params.activities,
          assetType: params.assetType as any,
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

  // -------------------------------------------
  // Mutación (requiere aprobación del usuario)
  // -------------------------------------------

  crear_orden_trabajo: tool({
    description:
      'Crea una nueva orden de trabajo en GIMA. SOLO úsala cuando el usuario EXPLÍCITAMENTE pida crear una orden de trabajo. Esta acción modifica datos en el sistema.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        equipment: z.string().default('Sin especificar'),
        description: z.string().default(''),
        priority: safeEnum(['baja', 'media', 'alta']).default('media'),
        location: z.string().optional(),
      })
    ),
    // No execute — client-side tool handled via addToolApprovalResponse.
    // El cliente renderiza OrderApprovalCard y llama executeWorkOrder al aprobar.
  }),
};

/** Condición de parada para multi-step tool calling */
export const TOOL_STOP_CONDITION = stepCountIs(5);

/** Tipo exportado de las tools para TypeScript */
export type ChatTools = typeof chatTools;
