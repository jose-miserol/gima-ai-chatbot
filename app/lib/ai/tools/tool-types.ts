/**
 * @file tool-types.ts
 * @module app/actions/tool-types
 *
 * ============================================================
 * TIPOS COMPARTIDOS — FILTROS Y RESPUESTAS DE CHAT TOOLS
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define las interfaces TypeScript que actúan como contrato entre
 *   las chat tools del sistema de IA de GIMA y los componentes de UI
 *   que renderizan sus respuestas.
 *
 *   Hay dos categorías de tipos:
 *   1. Filtros de entrada (Input Filters) — parámetros que el LLM puede
 *      pasar a cada tool al invocarla (ej. filtrar activos por estado).
 *   2. Respuestas de tools (Tool Results) — objetos tipados que la tool
 *      retorna al chat, incluyendo tanto casos de éxito como de error.
 *
 * CONTEXTO EN GIMA:
 *   El asistente de IA puede invocar tools para consultar datos en tiempo
 *   real del backend (activos, mantenimientos, repuestos, etc.). Estos tipos
 *   garantizan que:
 *     a) Gemini reciba parámetros válidos (validados por Zod en cada tool).
 *     b) El componente de chat renderice la respuesta con el tipo correcto
 *        sin necesidad de type assertions o comprobaciones en runtime.
 *
 * RELACIÓN CON OTROS MÓDULOS:
 *   - Las tools del chat importan estos tipos para tipar sus parámetros
 *     de entrada y sus valores de retorno.
 *   - Los componentes de UI (ej. ActivosTable, MantenimientosTable) usan
 *     ToolQueryResult<T> para tipar las props de datos que reciben.
 *   - backend-response.schema.ts define los tipos de dominio (Activo,
 *     Repuesto, etc.) que este módulo re-exporta para evitar imports
 *     circulares en los consumidores.
 *
 * POR QUÉ UN ARCHIVO CENTRALIZADO DE TIPOS:
 *   - Evita duplicar interfaces entre las distintas tool files.
 *   - Un único punto de cambio si el backend evoluciona su contrato.
 *   - Permite que los componentes de renderizado importen solo desde
 *     este módulo, sin acoplarse directamente al schema del backend.
 *
 * PATRÓN DISCRIMINATED UNION EN ToolResult<T>:
 *   ToolResult<T> = ToolQueryResult<T> | ToolErrorResult
 *   La propiedad `success: true / false` actúa como discriminante,
 *   permitiendo que TypeScript haga narrowing automático en los consumidores:
 *
 *   @example
 *   const result: ToolResult<Activo> = await getActivos(filtros);
 *   if (result.success) {
 *     // TypeScript sabe que result.data existe aquí
 *     renderTable(result.data);
 *   } else {
 *     // TypeScript sabe que result.error existe aquí
 *     showError(result.error);
 *   }
 *
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
// FILTROS DE ENTRADA PARA TOOLS
// ===========================================
//
// Cada interfaz corresponde a los parámetros que el LLM puede enviar
// al invocar una tool específica. Todos los campos son opcionales para
// que Gemini pueda invocar la tool con solo los filtros relevantes al
// contexto de la pregunta del usuario.
//
// Los campos `?` (opcionales) con valor `null` representan explícitamente
// "sin filtro aplicado" — diferente a omitir el campo — lo que permite
// al LLM indicar que quiere limpiar un filtro previo.
//
// ===========================================

/**
 * Filtros para la tool de consulta de activos industriales.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario pregunta algo como "¿Qué equipos están fuera de servicio?"
 *   o "Muéstrame los activos de tipo compresor". El LLM construye este objeto
 *   con los filtros que infiere de la pregunta en lenguaje natural.
 *
 * @property estado   - Estado operativo del activo ('activo', 'inactivo', 'en_reparacion').
 *                      Null indica sin filtro de estado.
 * @property buscar   - Texto libre para búsqueda por nombre, código o descripción.
 * @property tipo     - Categoría del activo ('equipo', 'mobiliario', 'vehiculo', etc.).
 *                      Null indica sin filtro de tipo.
 * @property page     - Número de página para paginación. Default 1 si se omite.
 */
export interface ActivosFiltros {
  estado?: string | null;
  buscar?: string;
  tipo?: string | null;
  page?: number;
}

/**
 * Filtros para la tool de consulta de órdenes de mantenimiento.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario pregunta "¿Qué mantenimientos urgentes hay pendientes?"
 *   o "Muestra los mantenimientos correctivos de la sede norte".
 *
 * @property estado     - Estado de la OT ('pendiente', 'en_proceso', 'completado', 'cancelado').
 * @property tipo       - Tipo de mantenimiento ('preventivo', 'correctivo', 'predictivo').
 * @property sede_id    - ID de la sede para filtrar por ubicación geográfica.
 * @property prioridad  - Nivel de urgencia ('baja', 'media', 'alta', 'critica').
 *                        Null indica sin filtro de prioridad.
 * @property page       - Número de página para paginación.
 */
export interface MantenimientosFiltros {
  estado?: string | null;
  tipo?: string | null;
  sede_id?: string;
  prioridad?: string | null;
  page?: number;
}

/**
 * Filtros para la tool de consulta de repuestos e inventario.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario pregunta "¿Qué repuestos están por debajo del stock mínimo?"
 *   o "Busca filtros de aceite del proveedor X en la bodega central".
 *
 * @property buscar        - Búsqueda por nombre, código de parte o descripción.
 * @property bajo_stock    - Si es true, filtra solo repuestos con stock < stock_minimo.
 *                           Útil para alertas de reabastecimiento.
 * @property proveedor_id  - ID del proveedor para ver qué piezas suministra.
 * @property direccion_id  - ID de la bodega o dirección de almacenamiento.
 * @property page          - Número de página para paginación.
 */
export interface RepuestosFiltros {
  buscar?: string;
  bajo_stock?: boolean;
  proveedor_id?: string;
  direccion_id?: string;
  page?: number;
}

/**
 * Filtros para la tool de consulta de reportes de fallas o incidencias.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario pregunta "¿Cuáles son los reportes críticos sin resolver?"
 *   o "Muéstrame los reportes cerrados de esta semana".
 *
 * @property prioridad  - Prioridad del reporte ('baja', 'media', 'alta', 'critica').
 * @property estado     - Estado del reporte ('abierto', 'en_revision', 'cerrado').
 * @property page       - Número de página para paginación.
 */
export interface ReportesFiltros {
  prioridad?: string | null;
  estado?: string | null;
  page?: number;
}

/**
 * Filtros para la tool de consulta del calendario de mantenimientos.
 *
 * CUÁNDO SE USA:
 *   Cuando el usuario pregunta "¿Qué mantenimientos están programados este mes?"
 *   El calendario incluye fechas de ejecución planificadas y recurrencias.
 *
 * @property page  - Número de página para paginación del listado de eventos.
 */
export interface CalendarioFiltros {
  page?: number;
}

// ===========================================
// RESPUESTAS DE TOOLS
// ===========================================
//
// Dos tipos de respuesta posibles, discriminados por `success`:
//   - ToolQueryResult<T>  → consulta exitosa con datos paginados + resumen.
//   - ToolErrorResult     → fallo con mensaje de error y sugerencia opcional.
//
// Se combinan en el union ToolResult<T> para uso en consumidores.
//
// ===========================================

/**
 * Respuesta exitosa de una tool de consulta de datos.
 *
 * QUÉ CONTIENE:
 *   - `data`    → Resultado paginado del backend con los registros encontrados.
 *                 Se tipifica con genérico T para reutilizar con cualquier
 *                 entidad (Activo, Repuesto, Mantenimiento, etc.).
 *   - `summary` → Texto en lenguaje natural generado por el LLM que resume
 *                 los datos retornados. Este texto es el que aparece en el
 *                 chat como respuesta visible al usuario antes de renderizar
 *                 la tabla o tarjetas de datos.
 *
 * @example
 *   // Respuesta de la tool de activos
 *   {
 *     success: true,
 *     data: { items: [...], total: 42, page: 1, totalPages: 5 },
 *     summary: "Encontré 42 activos activos. Los 10 más recientes son..."
 *   }
 */
export interface ToolQueryResult<T> {
  success: true;
  data: PaginatedResult<T>;
  summary: string;
}

/**
 * Respuesta de error de una tool.
 *
 * QUÉ CONTIENE:
 *   - `error`      → Descripción del problema ocurrido (para mostrar al usuario
 *                    o loguear en el servidor).
 *   - `suggestion` → Acción recomendada al usuario para resolver el error.
 *                    Opcional — si está presente, se muestra como hint en la UI.
 *
 * CUÁNDO SE RETORNA:
 *   - Error de red al llamar al backend.
 *   - Parámetros inválidos que no pasaron la validación Zod.
 *   - Recurso no encontrado (404) o sin permisos (403).
 *
 * @example
 *   {
 *     success: false,
 *     error: "No se pudo conectar con el servidor de inventario.",
 *     suggestion: "Verifica tu conexión o intenta nuevamente en unos segundos."
 *   }
 */
export interface ToolErrorResult {
  success: false;
  error: string;
  suggestion?: string;
}

/**
 * Union discriminada de los dos posibles resultados de una tool.
 *
 * USO RECOMENDADO:
 *   Usar como tipo de retorno en todas las tool functions del chat.
 *   TypeScript hará narrowing automático por `success` en los consumidores,
 *   sin necesidad de type guards adicionales.
 *
 * @see ToolQueryResult
 * @see ToolErrorResult
 */
export type ToolResult<T> = ToolQueryResult<T> | ToolErrorResult;

// ===========================================
// RE-EXPORTS DE TIPOS DE DOMINIO
// ===========================================
//
// Se re-exportan los tipos de backend-response.schema.ts para que los
// consumidores de tool-types.ts (tools del chat, componentes de UI) puedan
// importar todo desde un único punto, evitando acoplamientos directos
// con el schema del backend que podrían requerir actualizaciones masivas
// si el schema cambia de ubicación.
//
// ===========================================

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
