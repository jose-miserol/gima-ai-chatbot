/**
 * Chat Tools — Definiciones de herramientas para el chatbot GIMA
 *
 * Usa AI SDK v5 con:
 * - `tool()` + `inputSchema` (no 'parameters')
 * - `stopWhen: stepCountIs(N)` para multi-step
 * - `needsApproval: true` para tools de mutación
 * - `cookies()` de Next.js para propagación del token Sanctum
 *
 * Las tools hacen 2 tipos de operaciones:
 * 1. Consultas al backend Laravel (via BackendAPIService)
 * 2. Generación con IA (reutilizando ChecklistAIService, ActivitySummaryAIService)
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
 * Obtiene el BackendAPIService con el token Sanctum del usuario actual.
 * El token se extrae de las cookies de la request de Next.js.
 */
async function getAuthenticatedAPI() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    throw new BackendAuthError();
  }

  return createBackendAPIService({ token });
}

/**
 * Envuelve la ejecución de una tool con manejo de errores estandarizado.
 * Convierte excepciones en respuestas de error amigables para el LLM.
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
      {
        component: 'chatTools',
        action: toolName,
      }
    );

    if (error instanceof BackendAuthError) {
      return {
        success: false,
        error: 'No se pudo autenticar con el backend. Por favor, inicia sesión nuevamente.',
        suggestion: 'Recarga la página e inicia sesión.',
      };
    }

    if (error instanceof BackendTimeoutError) {
      return {
        success: false,
        error: error.message,
        suggestion: 'Intenta con filtros más específicos o inténtalo de nuevo.',
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

  consultar_activos: tool({
    description:
      'Busca activos/equipos registrados en GIMA. Usa esta herramienta cuando el usuario pregunte por equipos, activos, UMAs, bombas, tableros, su estado o ubicación. Devuelve datos paginados — si necesitas más resultados, pide la siguiente página.',
    inputSchema: z.object({
      estado: z
        .enum(['activo', 'inactivo', 'en_mantenimiento'])
        .optional()
        .describe('Filtrar por estado del activo'),
      buscar: z.string().optional().describe('Texto de búsqueda por nombre, código o tipo'),
      page: z.number().optional().default(1).describe('Número de página para paginación'),
    }),
    execute: async (params) => {
      return safeExecute('consultar_activos', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getActivos(params);
        return {
          success: true as const,
          data: result,
          summary: `Se encontraron ${result.pagination.total} activos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_activos_por_categoria: tool({
    description:
      'Obtiene activos agrupados por categoría/tipo. Usa cuando pregunten cuántos activos hay por tipo o quieran un resumen por categorías.',
    inputSchema: z.object({}),
    execute: async () => {
      return safeExecute('consultar_activos_por_categoria', async () => {
        const api = await getAuthenticatedAPI();
        const categorias = await api.getActivosPorCategoria();
        return {
          success: true as const,
          categorias,
          summary: `Se encontraron ${categorias.length} categorías de activos`,
        };
      });
    },
  }),

  // -------------------------------------------
  // Mantenimiento
  // -------------------------------------------

  consultar_mantenimientos: tool({
    description:
      'Consulta órdenes de mantenimiento. Usa cuando pregunten por mantenimientos pendientes, en progreso, historial, por tipo (preventivo/correctivo) o por sede. Devuelve datos paginados.',
    inputSchema: z.object({
      estado: z
        .enum(['pendiente', 'en_progreso', 'completado', 'cancelado'])
        .optional()
        .describe('Filtrar por estado del mantenimiento'),
      tipo: z
        .enum(['preventivo', 'correctivo', 'predictivo'])
        .optional()
        .describe('Filtrar por tipo de mantenimiento'),
      sede_id: z.string().optional().describe('ID de la sede/dirección para filtrar'),
      prioridad: z.string().optional().describe('Filtrar por prioridad'),
      page: z.number().optional().default(1).describe('Número de página'),
    }),
    execute: async (params) => {
      return safeExecute('consultar_mantenimientos', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getMantenimientos(params);
        return {
          success: true as const,
          data: result,
          summary: `Se encontraron ${result.pagination.total} mantenimientos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_calendario: tool({
    description:
      'Consulta el calendario de mantenimientos programados. Usa cuando pregunten por mantenimientos próximos, programaciones o agenda de mantenimiento.',
    inputSchema: z.object({
      page: z.number().optional().default(1).describe('Número de página'),
    }),
    execute: async (params) => {
      return safeExecute('consultar_calendario', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getCalendario(params);
        return {
          success: true as const,
          data: result,
          summary: `Se encontraron ${result.pagination.total} entradas en el calendario (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_reportes: tool({
    description:
      'Consulta reportes de mantenimiento. Usa cuando pregunten por reportes, fallos reportados, incidencias o problemas registrados.',
    inputSchema: z.object({
      prioridad: z.string().optional().describe('Filtrar por nivel de prioridad'),
      estado: z.string().optional().describe('Filtrar por estado del reporte'),
      page: z.number().optional().default(1).describe('Número de página'),
    }),
    execute: async (params) => {
      return safeExecute('consultar_reportes', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getReportes(params);
        return {
          success: true as const,
          data: result,
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
      'Busca repuestos en el inventario. Usa cuando pregunten por piezas, repuestos, stock disponible, o busquen un repuesto específico por código o descripción. Devuelve datos paginados.',
    inputSchema: z.object({
      buscar: z.string().optional().describe('Buscar por código o descripción del repuesto'),
      bajo_stock: z
        .boolean()
        .optional()
        .describe('Si es true, solo muestra repuestos con stock igual o menor al mínimo'),
      proveedor_id: z.string().optional().describe('Filtrar por ID del proveedor'),
      direccion_id: z.string().optional().describe('Filtrar por ID de la sede/dirección'),
      page: z.number().optional().default(1).describe('Número de página'),
    }),
    execute: async (params) => {
      return safeExecute('consultar_inventario', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getRepuestos(params);
        return {
          success: true as const,
          data: result,
          summary: `Se encontraron ${result.pagination.total} repuestos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  consultar_proveedores: tool({
    description:
      'Consulta la lista de proveedores registrados. Usa cuando pregunten por proveedores, contactos de proveedores, o quién suministra repuestos.',
    inputSchema: z.object({}),
    execute: async () => {
      return safeExecute('consultar_proveedores', async () => {
        const api = await getAuthenticatedAPI();
        const result = await api.getProveedores();
        return {
          success: true as const,
          data: result,
          summary: `Se encontraron ${result.pagination.total} proveedores`,
        };
      });
    },
  }),

  // -------------------------------------------
  // Generación con IA (servicios existentes)
  // -------------------------------------------

  generar_checklist: tool({
    description:
      'Genera un checklist de mantenimiento personalizado usando IA. Usa cuando pidan crear, generar o sugerir un checklist/lista de verificación para un tipo de activo y tarea.',
    inputSchema: z.object({
      assetType: z
        .enum([
          'hvac',
          'bomba',
          'caldera',
          'tablero',
          'generador',
          'compresor',
          'motor',
          'transformador',
        ])
        .describe('Tipo de activo para el checklist'),
      taskType: z
        .enum(['preventivo', 'correctivo', 'predictivo'])
        .describe('Tipo de tarea de mantenimiento'),
      customInstructions: z
        .string()
        .optional()
        .describe('Instrucciones adicionales del usuario para el checklist'),
    }),
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
      'Genera un resumen profesional de notas de actividad usando IA. Usa cuando pidan resumir actividades, notas técnicas, o crear un informe de trabajo realizado.',
    inputSchema: z.object({
      activities: z.string().describe('Notas de actividades a resumir (texto libre)'),
      assetType: z
        .enum([
          'hvac',
          'bomba',
          'caldera',
          'tablero',
          'generador',
          'compresor',
          'motor',
          'transformador',
        ])
        .optional()
        .default('hvac')
        .describe('Tipo de activo relacionado'),
      taskType: z
        .enum(['preventivo', 'correctivo', 'predictivo'])
        .optional()
        .default('preventivo')
        .describe('Tipo de tarea'),
      style: z
        .enum(['formal', 'technical', 'brief'])
        .optional()
        .default('technical')
        .describe('Estilo de escritura del resumen'),
      detailLevel: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .default('medium')
        .describe('Nivel de detalle del resumen'),
    }),
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
      'Crea una nueva orden de trabajo/mantenimiento en GIMA. SOLO usa esta herramienta cuando el usuario EXPLÍCITAMENTE pida crear una orden de trabajo. Esta acción modifica datos en el sistema.',
    inputSchema: z.object({
      equipment: z.string().describe('Nombre o identificador del equipo'),
      description: z.string().describe('Descripción del problema o tarea a realizar'),
      priority: z
        .enum(['urgent', 'high', 'normal', 'low'])
        .default('normal')
        .describe('Prioridad de la orden'),
      location: z.string().optional().describe('Ubicación del equipo'),
    }),
    // No execute — this is a client-side tool handled via addToolApprovalResponse.
    // The client renders an OrderApprovalCard and calls executeWorkOrder on approval.
  }),
};

/** Condición de parada para multi-step tool calling */
export const TOOL_STOP_CONDITION = stepCountIs(5);

/** Tipo exportado de las tools para TypeScript */
export type ChatTools = typeof chatTools;
