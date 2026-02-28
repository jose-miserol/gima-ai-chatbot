/**
 * Schemas Zod para respuestas del backend Laravel (GIMA API)
 *
 * Incluye:
 * - Schema genérico de paginación (LengthAwarePaginator de Laravel)
 * - Schemas de cada entidad basados en los modelos Eloquent
 */

import { z } from 'zod';

// ===========================================
// Paginación Laravel (LengthAwarePaginator)
// ===========================================

/**
 * Crea un schema Zod para respuestas paginadas de Laravel.
 * Laravel retorna `{ current_page, data: [...], last_page, per_page, total, ... }`
 */
export function laravelPaginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    current_page: z.number(),
    data: z.array(itemSchema),
    first_page_url: z.string().nullable().optional(),
    from: z.number().nullable(),
    last_page: z.number(),
    last_page_url: z.string().nullable().optional(),
    next_page_url: z.string().nullable(),
    path: z.string().optional(),
    per_page: z.number(),
    prev_page_url: z.string().nullable(),
    to: z.number().nullable(),
    total: z.number(),
  });
}

/** Tipo inferido de una respuesta paginada */
export type LaravelPaginated<T> = {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
  next_page_url: string | null;
  prev_page_url: string | null;
};

/** Resultado procesado después de unwrap de paginación */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    lastPage: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
}

// ===========================================
// Entidad: Dirección (sede)
// ===========================================

export const direccionSchema = z.object({
  id: z.number(),
  estado: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  calle: z.string().nullable().optional(),
  sede: z.string().nullable().optional(),
});

export type Direccion = z.infer<typeof direccionSchema>;

// ===========================================
// Entidad: Ubicación
// ===========================================

export const ubicacionSchema = z.object({
  id: z.number(),
  direccion_id: z.number(),
  edificio: z.string().nullable().optional(),
  piso: z.string().nullable().optional(),
  salon: z.string().nullable().optional(),
  direccion: direccionSchema.optional(),
});

export type Ubicacion = z.infer<typeof ubicacionSchema>;

// ===========================================
// Entidad: Artículo
// ===========================================

export const articuloSchema = z.object({
  id: z.number(),
  tipo: z.string(),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

export type Articulo = z.infer<typeof articuloSchema>;

// ===========================================
// Entidad: Activo
// ===========================================

export const activoSchema = z.object({
  id: z.number(),
  articulo_id: z.number(),
  ubicacion_id: z.number(),
  estado: z.string(),
  valor: z.number().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  // Relaciones expandidas (cuando el backend las incluye con ->load())
  articulo: articuloSchema.optional(),
  ubicacion: ubicacionSchema.optional(),
});

export type Activo = z.infer<typeof activoSchema>;

// ===========================================
// Entidad: Reporte
// ===========================================

export const reporteSchema = z.object({
  id: z.number(),
  usuario_id: z.number(),
  activo_id: z.number(),
  descripcion: z.string(),
  prioridad: z.string().nullable().optional(),
  estado: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Reporte = z.infer<typeof reporteSchema>;

// ===========================================
// Entidad: Mantenimiento
// ===========================================

export const mantenimientoSchema = z.object({
  id: z.number(),
  activo_id: z.number(),
  supervisor_id: z.number().optional(),
  tecnico_principal_id: z.number().optional(),
  tipo: z.string(),
  reporte_id: z.number().nullable().optional(),
  fecha_apertura: z.string().optional(),
  fecha_cierre: z.string().nullable().optional(),
  estado: z.string(),
  descripcion: z.string().nullable().optional(),
  validado: z.boolean().nullable().optional(),
  costo_total: z.union([z.number(), z.string()]).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  // Relaciones
  activo: activoSchema.optional(),
  reporte: reporteSchema.optional(),
});

export type Mantenimiento = z.infer<typeof mantenimientoSchema>;

// ===========================================
// Entidad: Calendario de Mantenimiento
// ===========================================

export const calendarioSchema = z.object({
  id: z.number(),
  activo_id: z.number().optional(),
  tecnico_asignado_id: z.number().optional(),
  tipo: z.string().nullable().optional(),
  fecha_programada: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  // Relaciones
  activo: activoSchema.optional(),
});

export type CalendarioMantenimiento = z.infer<typeof calendarioSchema>;

// ===========================================
// Entidad: Proveedor
// ===========================================

export const proveedorSchema = z.object({
  id: z.number(),
  nombre: z.string().nullable().optional(),
  contacto: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export type Proveedor = z.infer<typeof proveedorSchema>;

// ===========================================
// Entidad: Repuesto (Inventario)
// ===========================================

export const repuestoSchema = z.object({
  id: z.number(),
  proveedor_id: z.number().optional(),
  direccion_id: z.number().optional(),
  descripcion: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  stock: z.number().nullable().optional(),
  stock_minimo: z.number().nullable().optional(),
  costo: z.union([z.number(), z.string()]).nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  // Relaciones
  proveedor: proveedorSchema.optional(),
});

export type Repuesto = z.infer<typeof repuestoSchema>;

// ===========================================
// Agrupación por categoría (activos)
// ===========================================

export const categoriaActivosSchema = z.object({
  tipo: z.string(),
  total: z.number(),
  activos: z.array(activoSchema).optional(),
});

export type CategoriaActivos = z.infer<typeof categoriaActivosSchema>;
