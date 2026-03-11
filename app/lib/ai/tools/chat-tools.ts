/**
 * @file chat-tools.ts
 * @module app/lib/services/chat-tools (o app/api/chat/tools)
 *
 * ============================================================
 * DEFINICIÓN DE HERRAMIENTAS DEL CHAT — TOOL CALLING GIMA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define todas las "herramientas" (tools) que el LLM puede invocar durante
 *   una conversación de chat para consultar datos reales del backend GIMA,
 *   ejecutar acciones y generar contenido con IA.
 *
 *   Cuando el usuario escribe "¿Cuáles son los activos en mantenimiento?",
 *   el LLM decide llamar a `consultar_activos({ estado: 'mantenimiento' })`.
 *   El Vercel AI SDK ejecuta la función `execute()` de esa herramienta,
 *   obtiene los datos del backend Laravel y los inyecta de vuelta al contexto
 *   del LLM para que formule una respuesta natural.
 *
 * CATÁLOGO DE HERRAMIENTAS:
 *
 *   CATÁLOGO DE ACTIVOS:
 *   ├── consultar_activos        → GET equipos/activos con filtros
 *
 *   MANTENIMIENTO:
 *   ├── consultar_mantenimientos → GET órdenes de mantenimiento
 *   ├── consultar_calendario     → GET calendario de mantenimientos programados
 *   └── consultar_reportes       → GET reportes de fallos e incidencias
 *
 *   INVENTARIO:
 *   └── consultar_inventario     → GET repuestos con filtro de bajo stock
 *
 *   PROVEEDORES:
 *   └── consultar_proveedores    → GET proveedores y sus contactos
 *
 *   HERRAMIENTAS DE IA:
 *   ├── generar_checklist        → Genera checklist de mantenimiento con Llama 3.3 70B
 *   └── generar_resumen_actividad → Genera resumen profesional de actividades con IA
 *
 *   ACCIONES:
 *   └── crear_orden_trabajo      → Client-side tool: renderiza tarjeta de aprobación
 *
 * ARQUITECTURA DE SCHEMAS (PROBLEMA CENTRAL DE ESTE ARCHIVO):
 *   El LLM (GROQ/Llama) puede enviar valores "creativos" que no coinciden
 *   exactamente con los enums del backend. Ejemplo:
 *   - El usuario dice "aire acondicionado" → el LLM envía `assetType: "hvac"`
 *   - El backend espera `assetType: "unidad-hvac"`
 *
 *   SOLUCIÓN EN CAPAS:
 *   1. `z.preprocess()` en el inputSchema: normaliza ANTES de que Zod valide.
 *      Usando `normalizeAssetType` para tipos de activo y mapas de alias para
 *      otros campos como `style` y `detailLevel`.
 *   2. `safeEnum()`: campo string opcional que acepta cualquier valor sin lanzar error.
 *      Silencia rechazos del schema para que el LLM no aborte la herramienta.
 *   3. `validateEnum()` en execute(): valida el valor final en tiempo de ejecución,
 *      retornando `undefined` si no coincide. Esto evita el problema de GROQ
 *      rechazando valores no-enum ANTES de que lleguen al schema de Zod.
 *
 * GESTIÓN DE TOKENS (PROBLEMA TPM):
 *   Llama 3.1 8B Instant tiene un límite de 6,000 TPM (tokens por minuto).
 *   Las respuestas del backend pueden tener cientos de items que, acumulados
 *   en el contexto multi-step del AI SDK, exceden ese límite fácilmente.
 *   MITIGACIÓN:
 *   - MAX_ITEMS_PER_RESPONSE = 15: trunca los resultados antes de enviarlos al LLM.
 *   - MAX_DESCRIPTION_LENGTH = 120: trunca campos de descripción largos.
 *   - `truncate()`: aplica el límite con "…" al final.
 *   - Cuando se truncan items, se añade un campo `note` al resultado indicando
 *     cuántos hay en total y cómo obtener más (via `page` o filtros).
 *
 * NORMALIZACIÓN DE PAGINACIÓN (PROBLEMA DE VARIANTES DE LARAVEL):
 *   El backend Laravel puede retornar paginación en tres formatos distintos
 *   según el tipo de Resource/Paginator usado en cada endpoint:
 *   - `{ data[], meta: { current_page, per_page, total, last_page } }` (Resource)
 *   - `{ data[], current_page, total, ... }` (Simple paginator en raíz)
 *   - `{ items[], pagination: { page, perPage, total, lastPage } }` (Wrapper interno)
 *   `normalizePaginatedResponse()` unifica los tres en un formato consistente.
 *
 * HERRAMIENTA CLIENT-SIDE (crear_orden_trabajo):
 *   Esta herramienta NO tiene `execute()`. El LLM la "llama" y el cliente
 *   intercepta la tool call para renderizar una tarjeta de aprobación
 *   (OrderApprovalCard) que el usuario debe confirmar antes de crear la OT.
 *   Después, el cliente llama a `addToolOutput()` del AI SDK para continuar el stream.
 *
 * STOP CONDITION (TOOL_STOP_CONDITION):
 *   `stepCountIs(4)` limita el multi-step a 4 pasos máximo para evitar
 *   bucles infinitos donde el LLM sigue llamando herramientas sin terminar.
 *
 * DÓNDE SE USA:
 *   - app/lib/services/chat-service.ts → se pasa como `tools` a streamText()
 * ============================================================
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
// CONSTANTES DE LIMITACIÓN DE TOKENS
// ===========================================

/**
 * Número máximo de items que se envían al LLM por respuesta de tool call.
 *
 * POR QUÉ 15 (y no más):
 *   Llama 3.1 8B Instant tiene un límite de ~6,000 TPM (tokens por minuto).
 *   En conversaciones multi-step, el contexto se acumula: si la primera herramienta
 *   retorna 50 items y la segunda otros 50, el contexto total supera los 6,000
 *   tokens rápidamente. Con 15 items de ~80 tokens c/u = ~1,200 tokens por tool call,
 *   dejando margen para el historial de mensajes y la respuesta del modelo.
 *
 *   Cuando el backend tiene más items que este límite, se añade un campo `note`
 *   al resultado indicando el total real y cómo paginarlo.
 */
const MAX_ITEMS_PER_RESPONSE = 10;

/**
 * Longitud máxima para campos de descripción en las respuestas al LLM (caracteres).
 *
 * POR QUÉ 120:
 *   Las descripciones de equipos y mantenimientos del sistema GIMA pueden ser
 *   textos largos de reportes técnicos (>1000 chars). El LLM solo necesita
 *   el contexto suficiente para formular su respuesta — las primeras 120
 *   palabras suelen bastar para identificar el equipo y su situación.
 */
const MAX_DESCRIPTION_LENGTH = 120;

// ===========================================
// HELPERS DE TRANSFORMACIÓN Y VALIDACIÓN
// ===========================================

/**
 * Elimina campos null y undefined de un objeto antes de pasarlo al schema Zod.
 *
 * QUÉ HACE:
 *   Función de preprocess global que se aplica a TODOS los inputSchema.
 *   Si el LLM envía `{ estado: null, buscar: "bomba" }`, Zod fallaría porque
 *   los campos opcionales no aceptan `null` por defecto, solo `undefined`.
 *   `stripNulls` convierte el objeto a `{ buscar: "bomba" }` eliminando el null.
 *
 * PATRÓN DE USO:
 *   ```typescript
 *   inputSchema: z.preprocess(stripNulls, z.object({ ... }))
 *   ```
 *   Siempre es el PRIMER preprocess para limpiar el input del LLM antes de
 *   cualquier otra transformación.
 */
function stripNulls(val: unknown): Record<string, unknown> {
  if (!val || typeof val !== 'object') return {};
  const obj = val as Record<string, unknown>;
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * Trunca un string al límite de caracteres indicado, añadiendo "…" si se corta.
 *
 * QUÉ HACE:
 *   Limita la longitud de campos de texto antes de incluirlos en la respuesta
 *   al LLM, reduciendo el consumo de tokens del contexto.
 *
 * POR QUÉ RETORNA `undefined` PARA null/undefined:
 *   Si el campo no existe en el backend, retornar `undefined` hace que el
 *   campo se omita del objeto JSON al serializarlo, en lugar de incluir
 *   `"descripcion": undefined` (que sería `null` en JSON y consumiría tokens).
 *
 * @param str   - String a truncar (puede ser null/undefined si el backend no lo envía).
 * @param limit - Límite de caracteres. Default: MAX_DESCRIPTION_LENGTH (120).
 * @returns String truncado o undefined si la entrada era vacía/nula.
 */
function truncate(
  str: string | null | undefined,
  limit = MAX_DESCRIPTION_LENGTH
): string | undefined {
  if (!str) return undefined;
  return str.length > limit ? str.slice(0, limit) + '…' : str;
}

// ===========================================
// NORMALIZACIÓN DE TIPOS DE ACTIVO
// ===========================================

/**
 * ASSET_TYPE_VALUES — Lista canónica de tipos de activo del sistema GIMA.
 *
 * Estos son los valores exactos que el backend Laravel acepta.
 * Cualquier otro valor enviado por el LLM debe ser normalizado a uno de estos
 * antes de llegar al execute() de la herramienta.
 */
const ASSET_TYPE_VALUES = [
  'unidad-hvac', // Unidades Manejadoras de Aire, chillers, splits, fan coils
  'caldera', // Calderas de vapor o agua caliente
  'bomba', // Bombas centrífugas, de presión, de vacío
  'compresor', // Compresores de aire o refrigeración
  'generador', // Grupos electrógenos, plantas eléctricas
  'panel-electrico', // Tableros de distribución, MCC (Motor Control Centers)
  'transportador', // Cintas transportadoras, elevadores
  'grua', // Puentes grúa, polipastos
  'montacargas', // Montacargas eléctricos o de combustión
  'otro', // Activos no clasificados en las categorías anteriores
] as const;

type AssetType = (typeof ASSET_TYPE_VALUES)[number];

/**
 * ASSET_TYPE_ALIASES — Mapeo exhaustivo de variantes naturales a valores canónicos.
 *
 * POR QUÉ EXISTE ESTE MAPA (Raíz del problema):
 *   El system prompt (SYSTEM_PROMPT en server.ts, regla 14) instruye al LLM a
 *   mapear lenguaje natural al tipo de activo más cercano. Pero el LLM puede
 *   enviar variantes que no coinciden exactamente con los valores canónicos:
 *
 *   Usuario: "revisa el aire acondicionado del piso 3"
 *   LLM envía: `assetType: "hvac"` (o "ac", o "aire acondicionado")
 *   Backend espera: `assetType: "unidad-hvac"`
 *
 *   Sin este mapa, Zod lanzaría "Invalid input: expected string, received undefined"
 *   porque el preprocess anterior descartaba silenciosamente los valores no canónicos.
 *
 * ESTRATEGIA DE NORMALIZACIÓN (en normalizeAssetType):
 *   1. Si el valor ya es canónico → retornar tal cual.
 *   2. Si existe en este mapa de alias → retornar el valor canónico.
 *   3. Si contiene algún alias (búsqueda parcial) → retornar el valor canónico.
 *   4. Sin match → retornar undefined → execute() usa 'otro' como fallback.
 */
const ASSET_TYPE_ALIASES: Record<string, AssetType> = {
  // HVAC / Aire acondicionado (múltiples términos en uso en la UNEG)
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
  // Eléctrico / Tableros
  electrico: 'panel-electrico',
  'panel electrico': 'panel-electrico',
  'tablero electrico': 'panel-electrico',
  tablero: 'panel-electrico',
  mcc: 'panel-electrico', // Motor Control Center
  // Bombas (solo inglés porque el español ya está en ASSET_TYPE_VALUES)
  pump: 'bomba',
  // Compresores
  compressor: 'compresor',
  // Generadores / Plantas eléctricas
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
  // Genérico / No clasificado
  general: 'otro',
  other: 'otro',
  equipo: 'otro',
};

/**
 * Normaliza el tipo de activo enviado por el LLM a su valor canónico.
 *
 * QUÉ HACE:
 *   Función de preprocess que transforma el valor del campo `assetType` del LLM
 *   antes de que Zod lo valide. Aplica la estrategia de tres pasos descrita
 *   en ASSET_TYPE_ALIASES arriba.
 *
 * MANEJO DE ARRAYS:
 *   Algunos LLMs envían valores como array (ej: `["hvac"]`).
 *   `Array.isArray(val) ? val[0] : val` extrae el primer elemento.
 *
 * RESULTADO:
 *   - Valor canónico ('unidad-hvac', 'bomba', etc.) → Zod lo acepta directamente.
 *   - `undefined` → el schema lo acepta (campo .optional()) → execute() usa 'otro'.
 *
 * @param val - Valor crudo enviado por el LLM (puede ser string, array, null, etc.)
 * @returns Valor canónico normalizado, el valor original si ya es canónico, o undefined.
 */
function normalizeAssetType(val: unknown): unknown {
  const raw = Array.isArray(val) ? val[0] : val;
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string') return raw;

  const normalized = raw.trim().toLowerCase();

  // Paso 1: ¿Ya es un valor canónico? → retornar normalizado (lowercase)
  if ((ASSET_TYPE_VALUES as readonly string[]).includes(normalized)) return normalized;

  // Paso 2: ¿Coincidencia exacta en el mapa de alias?
  const mapped = ASSET_TYPE_ALIASES[normalized];
  if (mapped) return mapped;

  // Paso 3: ¿El string contiene algún alias conocido? (búsqueda parcial)
  // Ejemplo: "bomba centrifuga" contiene "bomba" → 'bomba' (aunque no es un alias directo,
  // aquí itera los aliases para encontrar la categoría más probable)
  for (const [alias, canonical] of Object.entries(ASSET_TYPE_ALIASES)) {
    if (normalized.includes(alias)) return canonical;
  }

  // Sin match → undefined; execute() usará 'otro' como fallback seguro
  return undefined;
}

// ===========================================
// HELPERS DE SCHEMA PARA LLMs
// ===========================================

/**
 * Crea un campo de schema string opcional con lista de valores sugeridos vía .describe().
 *
 * PROBLEMA QUE RESUELVE:
 *   Si se usa `z.enum(['a','b','c'])` en un inputSchema y el LLM envía un valor
 *   no listado, GROQ rechaza la herramienta entera antes de que llegue a execute().
 *   Esto es un problema del proveedor (GROQ valida el JSON Schema en el servidor)
 *   que no ocurre con OpenAI pero sí con Llama vía GROQ.
 *
 * SOLUCIÓN:
 *   Usar `z.string().optional()` para que el schema acepte cualquier valor,
 *   e incluir los valores permitidos en `.describe()` como "hint" para el LLM.
 *   La validación real ocurre en execute() con `validateEnum()`.
 *
 * POR QUÉ NO HAY `z.optional()` INTERNO (Fix #8 previo):
 *   Una inner `.optional()` redundante generaba un `anyOf` innecesario en el
 *   JSON Schema exportado, confundiendo al Anthropic API. La solución es
 *   usar `.optional()` directamente en la cadena de Zod.
 *
 * @param allowedValues - Tupla de valores permitidos para el hint del LLM.
 * @returns Schema Zod string opcional con descripción de valores permitidos.
 */
function safeEnum<T extends string>(allowedValues: readonly [T, ...T[]]) {
  return z
    .string()
    .describe(
      `Valores permitidos: ${allowedValues.join(' | ')}. Si el valor está vacío o no coincide, envíalo tal cual o vacío.`
    )
    .optional();
}

/**
 * Valida un valor contra una lista de permitidos en tiempo de ejecución.
 *
 * PROBLEMA QUE RESUELVE (pareja de safeEnum):
 *   `safeEnum` acepta cualquier string en el schema, pero execute() necesita
 *   saber si el valor que llegó es realmente válido para el backend.
 *   Esta función hace esa validación DENTRO del execute(), después de que
 *   el schema ya aceptó el valor.
 *
 * POR QUÉ EN execute() Y NO EN el schema:
 *   `z.preprocess()` con enum en el schema genera un JSON Schema incompatible
 *   con GROQ (el proveedor rechazaba valores no-enum antes de llegar al execute).
 *   Al mover la validación al execute(), el schema no restringe los valores y
 *   GROQ no interfiere.
 *
 * @param value         - Valor enviado por el LLM (puede ser string, null, etc.)
 * @param allowedValues - Lista de valores válidos para el backend.
 * @returns El valor normalizado (lowercase trimmed) si es válido, o `undefined`.
 */
function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): T | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const str = String(value).trim().toLowerCase();
  return (allowedValues as readonly string[]).includes(str) ? (str as T) : undefined;
}

// ===========================================
// NORMALIZACIÓN DE PAGINACIÓN DEL BACKEND
// ===========================================

/**
 * Normaliza respuestas paginadas del backend Laravel a un formato unificado.
 *
 * PROBLEMA QUE RESUELVE:
 *   Laravel puede retornar paginación en múltiples formatos según el tipo de
 *   Resource/Paginator usado en cada endpoint del backend GIMA:
 *
 *   FORMATO 1 — Laravel API Resource con meta (más común):
 *   ```json
 *   { "data": [...], "links": {...}, "meta": { "current_page": 1, "total": 50, ... } }
 *   ```
 *
 *   FORMATO 2 — Laravel Simple Paginator (campos en raíz):
 *   ```json
 *   { "data": [...], "current_page": 1, "total": 50, "per_page": 15, "last_page": 4 }
 *   ```
 *
 *   FORMATO 3 — Wrapper interno del servicio GIMA:
 *   ```json
 *   { "items": [...], "pagination": { "page": 1, "perPage": 15, "total": 50, "lastPage": 4 } }
 *   ```
 *
 *   PROBLEMA ADICIONAL (Fix #7 previo):
 *   Algunos endpoints de Laravel Paginator retornan `links` como ARRAY en lugar de
 *   objeto, lo que causaba que el código de detección de formato se confundiera.
 *   La condición `!Array.isArray(r.pagination)` previene este falso positivo.
 *
 * PRIORIDAD DE DETECCIÓN:
 *   1. Si `r.pagination` es un objeto → Formato 3 (wrapper interno).
 *   2. Si `r.meta` es un objeto → Formato 1 (Laravel API Resource).
 *   3. Fallback → Formato 2 (campos en raíz) o estructura desconocida.
 *
 * @param raw - Respuesta cruda del backend (puede ser cualquier estructura).
 * @returns Objeto normalizado con `items[]` y `pagination` unificado.
 */
function normalizePaginatedResponse(raw: unknown): {
  items: unknown[];
  pagination: { page: number; perPage: number; total: number; lastPage: number };
} {
  if (!raw || typeof raw !== 'object') {
    return { items: [], pagination: { page: 1, perPage: 15, total: 0, lastPage: 1 } };
  }

  const r = raw as Record<string, unknown>;

  // PRIORIDAD 1: Wrapper interno { items, pagination: object }
  // La condición !Array.isArray previene confusión con `links` array de Laravel (Fix #7)
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

  // Extraer items de `data` (Laravel Resource) o `items` (wrapper alternativo)
  const items = Array.isArray(r.data) ? r.data : Array.isArray(r.items) ? r.items : [];

  // PRIORIDAD 2: Laravel API Resource con meta objeto
  // La condición !Array.isArray excluye `links` que también puede estar presente
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

  // FALLBACK: Campos de paginación en la raíz del objeto (Laravel Simple Paginator)
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

// ===========================================
// HELPERS DE AUTENTICACIÓN Y EJECUCIÓN
// ===========================================

/**
 * Obtiene una instancia del BackendAPIService con el token de sesión actual.
 *
 * QUÉ HACE:
 *   Lee la cookie HTTP-only 'auth_token' (establecida por loginSilent en auth.ts)
 *   y crea un cliente del backend autenticado para la request actual.
 *
 * POR QUÉ await cookies():
 *   En Next.js 15+, la API de cookies es asíncrona. Debe awaitearse antes
 *   de llamar a `.get()`.
 *
 * @throws BackendAuthError si la cookie 'auth_token' no existe o está vacía.
 *         Esto ocurre cuando la sesión expiró o el Silent Login falló.
 *         safeExecute() captura este error y retorna un mensaje amigable al usuario.
 */
async function getAuthenticatedAPI() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new BackendAuthError();
  return createBackendAPIService({ token });
}

/**
 * Detecta si un error es un timeout de conexión al backend.
 *
 * QUÉ HACE:
 *   Verifica si el error es BackendTimeoutError (clase tipada) o si el mensaje
 *   de un Error genérico contiene indicadores de timeout de red.
 *
 * POR QUÉ VERIFICAR TAMBIÉN EL MENSAJE:
 *   Los errores de red del fetch nativo (Node.js) no tienen un tipo específico —
 *   se manifiestan como Error con mensajes como "ETIMEDOUT" o "ECONNABORTED".
 *   Sin esta comprobación de mensaje, esos timeouts serían tratados como errores
 *   genéricos con el mensaje técnico expuesto al usuario.
 *
 * @param error - Cualquier error capturado en el try/catch de safeExecute.
 * @returns `true` si el error es claramente un timeout de red.
 */
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
 * Ejecuta una función de tool call con manejo centralizado de errores.
 *
 * QUÉ HACE:
 *   Envuelve el execute() de cada herramienta en un try/catch que:
 *   1. Loguea el error con contexto (tool name, componente).
 *   2. Mapea errores tipados a mensajes amigables para el LLM.
 *   3. Retorna un ToolErrorResult en lugar de lanzar la excepción.
 *
 * POR QUÉ RETORNAR ERROR EN LUGAR DE LANZAR:
 *   Si execute() lanza, el AI SDK termina el stream con un error genérico
 *   que el usuario ve como "Error al procesar" sin contexto. Al retornar
 *   un objeto de error tipado, el LLM puede formular una respuesta natural
 *   como "No se pudo consultar los activos porque el servidor está caído.
 *   Por favor recarga la página."
 *
 * JERARQUÍA DE ERRORES MANEJADOS:
 *   1. BackendAuthError → sesión expirada → instrucción de recarga
 *   2. Timeout (BackendTimeoutError o mensaje de red) → servidor lento
 *   3. BackendAPIError → error HTTP del servidor (400, 500, etc.)
 *   4. Error genérico → mensaje directo
 *
 * FIX #10 (previo): Para errores que no son instancias de Error (objetos planos,
 *   strings, etc.), se usa `JSON.stringify()` en lugar de `String()` para evitar
 *   el inútil "[object Object]" en los logs.
 *
 * @param toolName - Nombre de la herramienta para contexto en logs.
 * @param fn       - Función async del execute() de la herramienta.
 * @returns Resultado de la herramienta o ToolErrorResult si falló.
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
        error:
          'GIMA Chatbot ha tenido dificultades para entender el contexto de la acción. Por favor, inténtalo de nuevo.',
        suggestion: 'Intenta reformular tu solicitud o proporcionar más detalles.',
      };
    }

    // Error genérico: serializar correctamente para evitar "[object Object]"
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
// DEFINICIÓN DE HERRAMIENTAS
// ===========================================

export const chatTools = {
  // ─────────────────────────────────────────
  // CATÁLOGO DE ACTIVOS
  // ─────────────────────────────────────────

  /**
   * consultar_activos — Busca equipos/activos registrados en GIMA.
   *
   * QUÉ HACE:
   *   Consulta el endpoint de activos del backend con filtros opcionales
   *   de estado, búsqueda por texto y tipo de activo.
   *
   * CAMPO `tipo` (Fix #9 previo):
   *   Anteriormente era un enum ['mobiliario','equipo'] que no corresponde
   *   a la API real. El campo `ArticuloResource.tipo` es string libre en el backend
   *   (ej: "Bomba de Agua", "Compresor de Tornillo"). Se cambió a z.string() con
   *   descripción para que el LLM pueda enviar cualquier texto.
   *
   * CAMPO `estado`:
   *   Usa safeEnum() para que GROQ no rechace la herramienta si el LLM envía
   *   un estado inválido. La validación real ocurre en execute() con validateEnum().
   *
   * PAGINACIÓN:
   *   Acepta `page` como número o string (el LLM a veces envía "2" como string).
   *   `z.string().transform(parseInt)` maneja ambos casos.
   */
  consultar_activos: tool({
    description:
      'Consulta, lista o busca activos/equipos registrados por nombre, código, estado o ubicación. ' +
      'NO la uses si el usuario solo menciona un activo sin pedir una consulta explícita. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(
      stripNulls, // Eliminar nulls del LLM antes de validar
      z.object({
        // safeEnum: acepta cualquier string, describe los valores válidos para el LLM
        estado: safeEnum(['operativo', 'mantenimiento', 'fuera_servicio', 'baja']),
        buscar: z.string().optional(),
        // Fix #9: string libre (no enum) porque ArticuloResource.tipo es string libre en el backend
        tipo: z
          .string()
          .optional()
          .describe('Tipo de activo en texto libre, ej: "bomba", "compresor", "mobiliario"'),
        // Acepta número o string "2" → parseInt
        page: z
          .union([z.number(), z.string().transform((v) => parseInt(v, 10))])
          .optional()
          .default(1),
      })
    ),
    execute: async (params) => {
      return safeExecute('consultar_activos', async () => {
        const api = await getAuthenticatedAPI();

        // validateEnum en execute() (no en schema) para evitar rechazo de GROQ
        const estado = validateEnum(params.estado, [
          'operativo',
          'mantenimiento',
          'fuera_servicio',
          'baja',
        ] as const);

        const raw = await api.getActivos({ ...params, estado });
        const result = normalizePaginatedResponse(raw);

        // Limitar items para evitar TPM overflow (Fix Error 2)
        const items = result.items.slice(0, MAX_ITEMS_PER_RESPONSE);

        return {
          success: true as const,
          data: {
            items: items.map((item: any) => ({
              id: item.id,
              codigo: item.codigo,
              estado: item.estado,
              valor: item.valor,
              // Proyección de campos relevantes: omitir campos que el LLM no necesita
              articulo: {
                tipo: item.articulo?.tipo,
                descripcion: truncate(item.articulo?.descripcion), // Limitar tokens
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
            // Nota informativa cuando el backend tiene más items que el límite
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
  // MANTENIMIENTO
  // ─────────────────────────────────────────

  /**
   * consultar_mantenimientos — Consulta órdenes de mantenimiento con filtros.
   *
   * QUÉ HACE:
   *   Obtiene órdenes de mantenimiento del backend con filtros opcionales
   *   de estado, tipo (preventivo/correctivo/predictivo) y prioridad.
   *
   * PROYECCIÓN DE CAMPOS:
   *   Los campos de reporte están disponibles en dos niveles:
   *   - Directamente en el item (ej: item.prioridad)
   *   - Anidados en el reporte (ej: item.reporte.prioridad)
   *   El || sirve como fallback entre ambas ubicaciones por inconsistencia de la API.
   *
   *   Fix #4 (previo): El campo del reporte es 'descripcion', no 'titulo'.
   *   La API de GIMA no tiene campo 'titulo' en ReporteResource.
   */
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

        // Validar enums en execute() después de que safeEnum los aceptó sin restricción
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
              // Fallback: prioridad puede estar en el item directamente o en el reporte anidado
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
                descripcion: truncate(item.reporte?.descripcion), // Fix #4: 'descripcion', no 'titulo'
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

  /**
   * consultar_calendario — Consulta el calendario de mantenimientos programados.
   *
   * QUÉ HACE:
   *   Obtiene la agenda de mantenimientos futuros programados. A diferencia de
   *   `consultar_mantenimientos` que incluye historial, este endpoint está
   *   orientado a planificación (qué hay que hacer próximamente).
   *
   * SIMPLICIDAD DEL SCHEMA:
   *   Solo acepta `page` porque el endpoint de calendario no tiene más filtros.
   *   La paginación permite ver semanas/meses futuros.
   */
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

  /**
   * consultar_reportes — Consulta reportes de fallos e incidencias.
   *
   * QUÉ HACE:
   *   Obtiene reportes de problemas, fallos y mantenimientos solicitados,
   *   con filtros de prioridad y estado del reporte.
   *
   * FIX #3 (previo):
   *   Los campos del ReporteResource son 'descripcion' y 'created_at'.
   *   La versión anterior mapeaba incorrectamente a 'titulo' y 'fecha_reporte'
   *   que no existen en la API, causando que el LLM recibiera undefined en esos campos.
   */
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
              descripcion: truncate(item.descripcion), // Fix #3: 'descripcion', no 'titulo'
              estado: item.estado,
              prioridad: item.prioridad,
              created_at: item.created_at, // Fix #3: 'created_at', no 'fecha_reporte'
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
  // INVENTARIO
  // ─────────────────────────────────────────

  /**
   * consultar_inventario — Busca repuestos en el inventario de GIMA.
   *
   * QUÉ HACE:
   *   Consulta el inventario de repuestos con búsqueda por nombre y
   *   filtro de bajo stock para alertas de reabastecimiento.
   *
   * FIX #1 (previo):
   *   Los campos del RepuestoResource son directos en el item raíz:
   *   item.nombre, item.codigo, item.stock.
   *   La versión anterior los buscaba incorrectamente bajo item.articulo.*,
   *   retornando undefined para todos los campos de texto del repuesto.
   *
   * CAMPO `bajo_stock`:
   *   El sistema GIMA tiene alertas de stock mínimo. Con bajo_stock: true,
   *   el backend filtra repuestos donde stock <= stock_minimo.
   *   El system prompt (regla 11) indica al LLM usar este filtro cuando el
   *   usuario pregunte por "piezas agotándose" o "stock bajo".
   */
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
              nombre: item.nombre, // Fix #1: directamente en item, no en item.articulo
              codigo: item.codigo, // Fix #1: ídem
              descripcion: truncate(item.descripcion), // Fix #1: ídem
              stock: item.stock,
              stock_minimo: item.stock_minimo, // Para que el LLM pueda calcular la criticidad
              costo: item.costo,
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} repuestos (página ${result.pagination.page} de ${result.pagination.lastPage})`,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // PROVEEDORES
  // ─────────────────────────────────────────

  /**
   * consultar_proveedores — Lista los proveedores de repuestos registrados.
   *
   * QUÉ HACE:
   *   Obtiene el directorio de proveedores con su información de contacto
   *   y cantidad de repuestos que suministran.
   *
   * FIX #2 (previo):
   *   El campo de contacto en ProveedorResource es 'contacto', no 'contacto_principal'.
   *   La versión anterior mapeaba incorrectamente causando undefined en ese campo.
   *
   * SIN FILTROS:
   *   Este endpoint no tiene filtros porque el directorio de proveedores suele
   *   ser pequeño (<100 registros) y se lista completo. MAX_ITEMS_PER_RESPONSE
   *   aún aplica como protección.
   */
  consultar_proveedores: tool({
    description:
      'Lista los proveedores registrados y sus contactos de suministro. ' +
      'Una sola llamada es suficiente; NO repitas esta tool en el mismo turno.',
    inputSchema: z.preprocess(stripNulls, z.object({})), // Sin filtros: endpoint de listado completo
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
              contacto: item.contacto, // Fix #2: 'contacto', no 'contacto_principal'
              telefono: item.telefono,
              email: item.email,
              repuestos_count: item.repuestos_count, // Cuántos repuestos suministra este proveedor
            })),
            pagination: result.pagination,
          },
          summary: `Se encontraron ${result.pagination.total} proveedores`,
        };
      });
    },
  }),

  // ─────────────────────────────────────────
  // HERRAMIENTAS DE IA
  // ─────────────────────────────────────────

  /**
   * generar_checklist — Genera un checklist de mantenimiento con IA.
   *
   * QUÉ HACE:
   *   Usa ChecklistAIService (Llama 3.3 70B vía GROQ) para generar un checklist
   *   estructurado de tareas de mantenimiento según el tipo de activo y tarea.
   *
   * NORMALIZACIÓN DE assetType (FIX Error 1):
   *   El LLM puede enviar "hvac" o "aire acondicionado" cuando el schema espera
   *   "unidad-hvac". `z.preprocess(normalizeAssetType, ...)` transforma el valor
   *   ANTES de que Zod lo evalúe, evitando el error:
   *   "Invalid input: expected string, received undefined"
   *
   * NORMALIZACIÓN DE taskType:
   *   El LLM puede enviar el tipo como array `["preventivo"]`. El preprocess
   *   `Array.isArray(val) ? val[0] : val` extrae el primer elemento.
   *
   * FALLBACK assetType → 'otro':
   *   Si normalizeAssetType retorna undefined (no encontró match), execute()
   *   usa 'otro' como fallback en lugar de fallar. Esto garantiza que siempre
   *   se genere un checklist genérico en el peor caso.
   *
   * CAMPO `cached`:
   *   ChecklistAIService puede cachear checklists frecuentes (AI_CACHE_TTL.CHECKLIST = 3600s).
   *   El campo `cached: true/false` en la respuesta ayuda al monitoreo de costos de IA.
   */
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
        // FIX Error 1: normalizeAssetType resuelve aliases ("hvac" → "unidad-hvac")
        // ANTES de que Zod valide, previniendo el error de tipo recibido como undefined
        assetType: z
          .preprocess(
            normalizeAssetType,
            z.string().describe(`Valores permitidos: ${ASSET_TYPE_VALUES.join(' | ')}`)
          )
          .optional(),
        // Preprocess extrae de arrays enviados por el LLM ["preventivo"] → "preventivo"
        taskType: z
          .preprocess(
            (val) => (Array.isArray(val) ? val[0] : val),
            z.enum(['preventivo', 'correctivo', 'predictivo'])
          )
          .optional()
          .default('preventivo'),
        customInstructions: z.string().optional(), // Instrucciones adicionales del usuario
      })
    ),
    execute: async (params) => {
      return safeExecute('generar_checklist', async () => {
        const service = new ChecklistAIService();
        const result = await service.generateChecklist({
          assetType: (params.assetType ?? 'otro') as any, // Fallback seguro si normalizeAssetType retornó undefined
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

  /**
   * generar_resumen_actividad — Genera un resumen profesional de actividades con IA.
   *
   * QUÉ HACE:
   *   Usa ActivitySummaryAIService (Llama 3.3 70B) para transformar notas crudas
   *   de actividad técnica en un resumen profesional formateado según el estilo
   *   y nivel de detalle solicitados.
   *
   * NORMALIZACIÓN DE `activities` (FIX Error 3 — regresión restaurada):
   *   PROBLEMA: El LLM puede enviar textos muy cortos como "Test" (4 chars) y el
   *   schema tenía `.min(10)` desnudo sin preprocess. Esto causaba que Zod rechazara
   *   el valor ANTES del execute(), generando "Failed to call a function" en la API
   *   de Anthropic (y GROQ), que es confuso y no informativo para el usuario.
   *
   *   SOLUCIÓN APLICADA: z.preprocess() normaliza entradas cortas a strings semánticos:
   *   - vacío → "Sin actividades registradas."
   *   - < 10 chars → "Actividad reportada: {texto}" (preserva el contenido, lo hace válido)
   *   La versión anterior usaba `padEnd(10, '.')` que generaba "Test......" — texto
   *   sin sentido que confundía al modelo de IA.
   *
   * NORMALIZACIÓN DE `style`:
   *   El LLM puede enviar términos en inglés ('formal', 'technical', 'brief') que
   *   se mapean a los valores del backend en español ('ejecutivo', 'tecnico', 'narrativo').
   *
   * NORMALIZACIÓN DE `detailLevel`:
   *   Ídem para niveles de detalle: 'low' → 'bajo', 'medium' → 'medio', 'high' → 'alto'.
   */
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
        // FIX Error 3: preprocess normaliza entradas cortas a strings válidos
        // en lugar de usar .min(10) desnudo que rechazaba el input antes del execute()
        activities: z.preprocess((val) => {
          if (typeof val !== 'string') return 'Sin actividades registradas.';
          const trimmed = val.trim();
          if (trimmed.length === 0) return 'Sin actividades registradas.';
          if (trimmed.length < 10) return `Actividad reportada: ${trimmed}`; // Preserva el contenido
          return trimmed;
        }, z.string().min(1).default('Sin actividades registradas.')),

        // FIX Error 1: mismo normalizeAssetType que en generar_checklist
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

        // Mapeo inglés → español para `style` (el LLM a veces usa términos en inglés)
        style: z
          .preprocess(
            (val) => {
              const raw = Array.isArray(val) ? val[0] : val;
              const map: Record<string, string> = {
                formal: 'ejecutivo', // "formal" en inglés → estilo ejecutivo de GIMA
                technical: 'tecnico',
                brief: 'narrativo',
              };
              return typeof raw === 'string' && map[raw] ? map[raw] : raw;
            },
            z.enum(['ejecutivo', 'tecnico', 'narrativo'])
          )
          .optional()
          .default('tecnico'),

        // Mapeo inglés → español para `detailLevel`
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
  // ACCIONES (CLIENT-SIDE TOOLS)
  // ─────────────────────────────────────────

  /**
   * crear_orden_trabajo — Inicia el flujo de creación de una OT con aprobación del usuario.
   *
   * QUÉ HACE (patrón client-side tool):
   *   A diferencia del resto de herramientas, esta NO tiene `execute()`.
   *   Cuando el LLM invoca esta herramienta, el AI SDK pausa el stream y
   *   el cliente (ChatContainer) intercepta la tool call para:
   *   1. Renderizar una OrderApprovalCard con los detalles de la OT propuesta.
   *   2. Esperar confirmación explícita del usuario.
   *   3. Si confirma → llamar a addToolOutput() y continuar el stream.
   *   4. Si rechaza → llamar a addToolOutput() con error y el LLM reconoce el rechazo.
   *
   * POR QUÉ CLIENT-SIDE Y NO SERVER-SIDE:
   *   Crear una OT en el backend es una acción irreversible que afecta la
   *   carga de trabajo del equipo. Requiere aprobación explícita del usuario
   *   antes de ejecutarse. La tarjeta de aprobación permite revisar y editar
   *   los campos antes de confirmar.
   *
   * CAMPO `description` CON PREPROCESS DE TRUNCADO:
   *   Si el LLM genera una descripción muy larga (>500 chars), el preprocess
   *   la trunca automáticamente en lugar de dejar que el schema la rechace.
   *   Esto es más robusto que confiar en que el LLM respete el límite.
   *
   * CAMPO `priority` CON DEFAULT 'media' (Fix #5 previo):
   *   `.default('media')` garantiza un valor cuando el LLM envía null o undefined
   *   para priority. Sin este default, el campo quedaría undefined y la
   *   OrderApprovalCard no podría renderizar la prioridad.
   *
   * CAMPO `location_text` (NOTA IMPORTANTE):
   *   Debe ser un nombre de lugar en texto libre (ej: "Edificio 3, piso 2"),
   *   NUNCA un ID numérico. El backend no acepta IDs en este campo.
   *   El execute() del cliente (executeWorkOrder) debe leer `location_text`,
   *   no un hipotético campo `location` ni intentar mapearlo a `direccion_id`.
   */
  crear_orden_trabajo: tool({
    description:
      'Crea una orden de trabajo en GIMA. SOLO cuando el usuario lo pida explícitamente. ' +
      'La descripción debe ser concisa (máx 500 caracteres); si el texto es más largo, resúmelo ANTES de llamar. ' +
      'location_text es el nombre del lugar en texto libre, NUNCA un ID numérico.',
    inputSchema: z.preprocess(
      stripNulls,
      z.object({
        equipment: z.string().default('Sin especificar'),
        // Preprocess trunca automáticamente si el LLM envía descripción demasiado larga
        description: z.preprocess(
          (val) => (typeof val === 'string' && val.length > 500 ? val.slice(0, 500) : (val ?? '')),
          z.string().max(500).default('')
        ),
        // Fix #5: .default('media') garantiza valor cuando priority es null/undefined
        priority: safeEnum(['baja', 'media', 'alta']).default('media'),
        location_text: z.string().optional(), // Nombre de lugar libre, NUNCA ID numérico
      })
    ),
    // SIN execute() — herramienta client-side.
    // El cliente intercepta esta tool call y renderiza OrderApprovalCard.
    // Tras confirmación del usuario, llama a addToolOutput() para continuar el stream.
  }),
};

// ===========================================
// EXPORTS DE CONTROL
// ===========================================

/**
 * TOOL_STOP_CONDITION — Condición de parada para el multi-step del AI SDK.
 *
 * QUÉ ES:
 *   `stepCountIs(4)` indica al Vercel AI SDK que detenga el ciclo de tool calling
 *   después de 4 pasos máximo, independientemente de si el LLM quiere seguir
 *   llamando herramientas.
 *
 * POR QUÉ 4 PASOS:
 *   Un flujo típico de GIMA raramente necesita más de 2-3 tool calls:
 *   1. consultar_activos
 *   2. consultar_mantenimientos (para el activo encontrado)
 *   3. generar_checklist (para el mantenimiento)
 *
 *   El límite de 4 previene bucles infinitos donde el LLM podría seguir
 *   llamando herramientas sin converger en una respuesta final.
 *
 * PASADO A: ChatService → streamText({ maxSteps: ... }) o como stopCondition.
 */
export const TOOL_STOP_CONDITION = stepCountIs(4);

/**
 * ChatTools — Tipo del objeto chatTools para usar en definiciones de tipo de ChatService.
 *
 * @example
 * ```typescript
 * function processChat(tools: ChatTools) { ... }
 * ```
 */
export type ChatTools = typeof chatTools;
