/**
 * @file backend-response.schema.ts
 * @module app/lib/schemas/backend-response.schema
 *
 * ============================================================
 * SCHEMAS ZOD — ENTIDADES Y PAGINACIÓN DEL BACKEND LARAVEL
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define los schemas Zod que validan y tipan las respuestas HTTP del
 *   backend Laravel de GIMA. Cubre dos categorías:
 *     1. Paginación: `laravelPaginatedSchema` maneja los dos formatos de
 *        paginación que puede devolver Laravel (plano y API Resource).
 *     2. Entidades de dominio: schemas para cada modelo Eloquent del backend
 *        (Activo, Mantenimiento, Repuesto, Proveedor, Reporte, Calendario).
 *
 * CONTEXTO EN GIMA:
 *   El backend es un API REST en Laravel. Las tools del chat (BackendAPIService)
 *   llaman a estos endpoints y usan estos schemas para:
 *     a) Validar que la respuesta del backend tiene la estructura esperada.
 *     b) Inferir los tipos TypeScript de las entidades sin duplicar definiciones.
 *     c) Hacer degradación graceful (fallback) si el schema evoluciona y
 *        algún campo cambia de tipo o se vuelve nullable.
 *
 * PAGINACIÓN EN LARAVEL (DOS FORMATOS):
 *   Laravel puede devolver datos paginados en dos formatos distintos según
 *   cómo esté configurado el controlador:
 *
 *   Formato 1 — API Resource Collection (recomendado en versiones recientes):
 *   ```json
 *   { "data": [...], "links": {...}, "meta": { "current_page": 1, "total": 50 } }
 *   ```
 *
 *   Formato 2 — LengthAwarePaginator plano (legacy):
 *   ```json
 *   { "data": [...], "current_page": 1, "last_page": 5, "total": 50, "links": [...] }
 *   ```
 *
 *   `laravelPaginatedSchema` usa `z.preprocess` para normalizar ambos formatos
 *   al mismo objeto interno antes de la validación, haciéndolo transparente
 *   para el resto de la aplicación.
 *
 * CAMPOS NULLABLE EN LAS ENTIDADES:
 *   Muchos campos del backend son `nullable` porque el modelo Eloquent
 *   puede tener relaciones no cargadas (`->withoutRelations()`) o campos
 *   opcionales según el flujo de creación. El patrón `.nullable().optional()`
 *   cubre ambos casos: el campo ausente en el JSON y el campo presente con valor null.
 *
 * RELACIONES EXPANDIDAS:
 *   Las entidades incluyen sus relaciones como campos opcionales (ej. `activo.articulo`).
 *   Son opcionales porque el backend las incluye solo cuando se llama con `->load()`
 *   o `->with()`. Sin esto, el schema fallaría en endpoints que no expanden relaciones.
 *
 */

import { z } from 'zod';

// ============================================================
// PAGINACIÓN LARAVEL
// ============================================================

/**
 * Crea un schema Zod para respuestas paginadas del backend Laravel.
 *
 * POR QUÉ UNA FUNCIÓN Y NO UN SCHEMA FIJO:
 *   La paginación es genérica: `laravelPaginatedSchema(activoSchema)` valida
 *   una página de activos, `laravelPaginatedSchema(repuestoSchema)` valida
 *   una página de repuestos. La función acepta el schema de ítems como parámetro
 *   para que TypeScript infiera el tipo correcto en cada uso.
 *
 * EL PREPROCESADOR z.preprocess:
 *   Detecta el formato de la respuesta (API Resource vs plano) y normaliza
 *   ambos al mismo objeto `{ data, links, meta }` antes de la validación.
 *   Si `links` llega como array (formato plano), se convierte a objeto vacío
 *   para que el schema no falle.
 *
 * @param itemSchema - Schema Zod para cada ítem del array `data`.
 * @returns Schema Zod para la respuesta paginada completa.
 *
 * @example
 * ```typescript
 * const schema = laravelPaginatedSchema(activoSchema);
 * const result = schema.parse(apiResponse);
 * // result.data: Activo[]
 * // result.meta.total: number
 * ```
 */
export function laravelPaginatedSchema<T extends z.ZodType>(itemSchema: T) {
  const metaShape = z.object({
    current_page: z.number(),
    from: z.number().nullable().optional(),
    last_page: z.number(),
    path: z.string().optional(),
    per_page: z.number(),
    to: z.number().nullable().optional(),
    total: z.number(),
  });

  return z.preprocess(
    (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return raw;
      const obj = raw as Record<string, unknown>;

      // Formato API Resource: tiene `meta` como objeto → ya está normalizado
      if (obj.meta && typeof obj.meta === 'object' && !Array.isArray(obj.meta)) {
        if (Array.isArray(obj.links)) {
          obj.links = {};
        }
        return obj;
      }

      // Formato plano: transformar a estructura normalizada
      return {
        data: obj.data ?? [],
        links: Array.isArray(obj.links) ? {} : obj.links || {},
        meta: {
          current_page: obj.current_page ?? 1,
          from: obj.from ?? null,
          last_page: obj.last_page ?? 1,
          path: obj.path,
          per_page: obj.per_page ?? 15,
          to: obj.to ?? null,
          total: obj.total ?? 0,
        },
      };
    },
    z.object({
      data: z.array(itemSchema),
      links: z
        .object({
          first: z.string().nullable().optional(),
          last: z.string().nullable().optional(),
          prev: z.string().nullable().optional(),
          next: z.string().nullable().optional(),
        })
        .optional(),
      meta: metaShape,
    })
  );
}

/** Tipo de la respuesta paginada cruda de Laravel (antes del unwrap). */
export type LaravelPaginated<T> = {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
  next_page_url: string | null;
  prev_page_url: string | null;
};

/**
 * Resultado procesado después del unwrap de paginación.
 *
 * Este es el formato que retorna `BackendAPIService` a las tools del chat.
 * Normaliza la terminología de Laravel (current_page, last_page) al
 * naming convention del frontend (page, lastPage) para consistencia.
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    lastPage: number;
    perPage: number;
    total: number;
    /** True si `links.next` tiene URL → hay más páginas disponibles. */
    hasMore: boolean;
  };
}

// ============================================================
// ENTIDADES DE DOMINIO
// ============================================================

/**
 * Schema para Dirección (sede física de GIMA).
 * Representa una ubicación geográfica: ciudad, sector, calle y nombre de sede.
 */
export const direccionSchema = z.object({
  id: z.number(),
  estado: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  calle: z.string().nullable().optional(),
  sede: z.string().nullable().optional(),
});

export type Direccion = z.infer<typeof direccionSchema>;

/**
 * Schema para Ubicación (posición específica dentro de una sede).
 * Granularidad más fina que Dirección: edificio, piso y salón.
 * La relación `direccion` se expande cuando el endpoint usa `->with('direccion')`.
 */
export const ubicacionSchema = z.object({
  id: z.number(),
  direccion_id: z.number().nullable().optional(),
  edificio: z.string().nullable().optional(),
  piso: z.string().nullable().optional(),
  salon: z.string().nullable().optional(),
  direccion: direccionSchema.optional(),
});

export type Ubicacion = z.infer<typeof ubicacionSchema>;

/**
 * Schema para Artículo (catálogo de tipos de activos).
 * Describe las características generales de un tipo de equipo o mobiliario
 * sin referirse a un activo específico (instancia).
 */
export const articuloSchema = z.object({
  id: z.number(),
  tipo: z.string(),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

export type Articulo = z.infer<typeof articuloSchema>;

/**
 * Schema para Activo (instancia específica de un equipo o mobiliario).
 *
 * Un Activo es un objeto físico rastreable: tiene ubicación, estado operativo
 * y valor económico. Se relaciona con un Artículo (su tipo) y una Ubicación.
 *
 * ESTADOS POSIBLES:
 *   - 'operativo'       → Funcionando con normalidad.
 *   - 'mantenimiento'   → Fuera de servicio temporalmente por mantenimiento.
 *   - 'fuera_servicio'  → No disponible (avería grave, en reparación externa).
 *   - 'baja'            → Dado de baja, no usar.
 */
export const activoSchema = z.object({
  id: z.number(),
  articulo_id: z.number().nullable().optional(),
  ubicacion_id: z.number().nullable().optional(),
  estado: z.enum(['operativo', 'mantenimiento', 'fuera_servicio', 'baja']).nullable().optional(),
  valor: z.number().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  articulo: articuloSchema.optional(),
  ubicacion: ubicacionSchema.optional(),
});

export type Activo = z.infer<typeof activoSchema>;

/**
 * Schema para Reporte (incidencia o falla reportada).
 *
 * Los técnicos crean reportes cuando detectan fallas en activos.
 * Un reporte puede originar una orden de mantenimiento.
 */
export const reporteSchema = z.object({
  id: z.number(),
  usuario_id: z.number().nullable().optional(),
  activo_id: z.number().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  prioridad: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Reporte = z.infer<typeof reporteSchema>;

/**
 * Schema para Mantenimiento (orden de trabajo de mantenimiento).
 *
 * Registra un trabajo de mantenimiento sobre un activo: quién lo ejecuta,
 * qué tipo es, cuándo se abrió/cerró, su costo y si fue validado.
 *
 * NOTA SOBRE costo_total:
 *   Se acepta tanto `number` como `string` porque el backend a veces
 *   devuelve el costo como string decimal ("1250.50") en lugar de número.
 */
export const mantenimientoSchema = z.object({
  id: z.number(),
  activo_id: z.number().nullable().optional(),
  supervisor_id: z.number().nullable().optional(),
  tecnico_principal_id: z.number().nullable().optional(),
  tipo: z.string().nullable().optional(),
  reporte_id: z.number().nullable().optional(),
  fecha_apertura: z.string().optional(),
  fecha_cierre: z.string().nullable().optional(),
  estado: z.string(),
  descripcion: z.string().nullable().optional(),
  validado: z.boolean().nullable().optional(),
  costo_total: z.union([z.number(), z.string()]).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  activo: activoSchema.optional(),
  reporte: reporteSchema.nullable().optional(),
});

export type Mantenimiento = z.infer<typeof mantenimientoSchema>;

/**
 * Schema para Calendario de Mantenimiento (mantenimientos programados).
 *
 * Representa eventos del calendario de mantenimiento preventivo:
 * qué activo, qué técnico asignado, cuándo está programado.
 */
export const calendarioSchema = z.object({
  id: z.number(),
  activo_id: z.number().nullable().optional(),
  tecnico_asignado_id: z.number().nullable().optional(),
  tipo: z.string().nullable().optional(),
  fecha_programada: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  activo: activoSchema.optional(),
});

export type CalendarioMantenimiento = z.infer<typeof calendarioSchema>;

/**
 * Schema para Proveedor (empresa suministradora de repuestos).
 *
 * Los proveedores están asociados a repuestos del inventario.
 * La información de contacto es opcional porque no siempre está cargada.
 */
export const proveedorSchema = z.object({
  id: z.number(),
  nombre: z.string().nullable().optional(),
  contacto: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export type Proveedor = z.infer<typeof proveedorSchema>;

/**
 * Schema para Repuesto (ítem de inventario de mantenimiento).
 *
 * Representa una pieza o insumo almacenado en bodega. El campo `stock_minimo`
 * se usa para alertas de reabastecimiento: cuando `stock < stock_minimo`
 * se considera bajo stock y aparece en las alertas del sistema.
 *
 * NOTA SOBRE costo:
 *   Acepta `number` y `string` por la misma razón que `costo_total` en Mantenimiento.
 */
export const repuestoSchema = z.object({
  id: z.number(),
  proveedor_id: z.number().nullable().optional(),
  direccion_id: z.number().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  codigo: z.string().nullable().optional(),
  stock: z.number().nullable().optional(),
  stock_minimo: z.number().nullable().optional(),
  costo: z.union([z.number(), z.string()]).nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  proveedor: proveedorSchema.optional(),
});

export type Repuesto = z.infer<typeof repuestoSchema>;

/**
 * Schema para agrupación de activos por categoría.
 *
 * Usado en endpoints de estadísticas/dashboard que retornan activos
 * agrupados por tipo (ej. "42 equipos, 15 mobiliarios").
 */
export const categoriaActivosSchema = z.object({
  tipo: z.string(),
  total: z.number(),
  activos: z.array(activoSchema).optional(),
});

export type CategoriaActivos = z.infer<typeof categoriaActivosSchema>;
