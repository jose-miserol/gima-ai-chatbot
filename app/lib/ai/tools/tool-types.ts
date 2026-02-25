/**
 * Tool Types — Tipos para filtros y respuestas de las chat tools
 *
 * Define las interfaces para los parámetros de entrada de cada tool
 * y los tipos de respuesta que serán renderizados en la UI.
 */

import type { PaginatedResult } from '@/app/lib/schemas/backend-response.schema';
import type {
  Activo,
  Mantenimiento,
  Repuesto,
  CalendarioMantenimiento,
  Reporte,
  Proveedor,
  CategoriaActivos,
} from '@/app/lib/schemas/backend-response.schema';

// ===========================================
// Filtros de entrada para tools
// ===========================================

export interface ActivosFiltros {
  estado?: string;
  buscar?: string;
  page?: number;
}

export interface MantenimientosFiltros {
  estado?: string;
  tipo?: string;
  sede_id?: string;
  prioridad?: string;
  page?: number;
}

export interface RepuestosFiltros {
  buscar?: string;
  bajo_stock?: boolean;
  proveedor_id?: string;
  direccion_id?: string;
  page?: number;
}

export interface ReportesFiltros {
  prioridad?: string;
  estado?: string;
  page?: number;
}

export interface CalendarioFiltros {
  page?: number;
}

// ===========================================
// Respuestas de Tools
// ===========================================

/** Respuesta exitosa de una tool de consulta */
export interface ToolQueryResult<T> {
  success: true;
  data: PaginatedResult<T>;
  summary: string;
}

/** Respuesta de error de una tool */
export interface ToolErrorResult {
  success: false;
  error: string;
  suggestion?: string;
}

export type ToolResult<T> = ToolQueryResult<T> | ToolErrorResult;

// Re-export para uso en tools
export type {
  Activo,
  Mantenimiento,
  Repuesto,
  CalendarioMantenimiento,
  Reporte,
  Proveedor,
  CategoriaActivos,
  PaginatedResult,
};
