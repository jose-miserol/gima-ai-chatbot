/**
 * @file chat.ts
 * @module app/lib/schemas/chat
 *
 * ============================================================
 * SCHEMAS ZOD — VALIDACIÓN DEL API DE CHAT
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define todos los schemas Zod para validar las peticiones HTTP al
 *   endpoint POST /api/chat. Es la única fuente de verdad sobre qué
 *   estructura de datos acepta el chat de GIMA.
 *
 *   Principio fundamental: SOLO valida estructura, NO transforma datos.
 *   La sanitización y transformación del contenido se delega a `chat-utils.ts`.
 *
 * CONTEXTO EN GIMA:
 *   El Route Handler del chat recibe mensajes del cliente (texto, imágenes,
 *   archivos). Antes de pasarlos al LLM, se valida la estructura para:
 *     a) Prevenir inyección de roles inválidos ('system' desde el cliente).
 *     b) Limitar el tamaño del payload (anti-DoS, anti-quota exhaustion).
 *     c) Garantizar que el modelo solicitado está en la lista blanca.
 *
 * DISCRIMINATED UNION EN messagePartSchema:
 *   Las partes de un mensaje pueden ser texto, imagen o archivo. Usar
 *   `z.discriminatedUnion('type', [...])` en lugar de `z.union([...])`
 *   tiene dos ventajas:
 *     1. Performance: Zod hace lookup O(1) por el campo `type` en lugar
 *        de probar cada alternativa secuencialmente.
 *     2. Mensajes de error: si `type` es inválido, el error indica exactamente
 *        qué valor se esperaba, en lugar de mostrar todos los errores de todas
 *        las alternativas.
 *
 * MANEJO DE `parts` CON `.catch(undefined)`:
 *   El campo `parts` de un mensaje puede tener formatos inválidos cuando viene
 *   de versiones anteriores del cliente o de herramientas externas que generan
 *   mensajes con estructura incompleta. En lugar de rechazar todo el mensaje,
 *   `.catch(undefined)` lo ignora silenciosamente: el contenido de texto del
 *   mensaje sigue siendo procesado normalmente.
 *
 * LISTA BLANCA DE MODELOS:
 *   `chatRequestSchema.model` solo acepta valores del array `AVAILABLE_MODELS`
 *   definido en app/config. Esto previene que clientes externos soliciten
 *   modelos no autorizados o inexistentes que podrían causar errores de API.
 *
 */

import { z } from 'zod';

import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/app/config';

// ============================================================
// SCHEMAS DE PARTES DE MENSAJE
// ============================================================

/**
 * Schema para partes de texto en un mensaje multimodal.
 * El campo `text` puede ser vacío — la sanitización posterior lo maneja.
 */
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/**
 * Schema para partes de imagen en un mensaje multimodal.
 * `imageUrl` debe ser una URL válida (data URL o URL remota).
 * `mimeType` informa al modelo el formato de la imagen (image/jpeg, image/png, etc.).
 */
const imagePartSchema = z.object({
  type: z.literal('image'),
  imageUrl: z.string().url(),
  mimeType: z.string(),
});

/**
 * Schema para partes de archivo en un mensaje multimodal.
 * `data` es el contenido base64 del archivo.
 * `mediaType` informa al modelo el tipo del archivo (application/pdf, audio/webm, etc.).
 */
const filePartSchema = z.object({
  type: z.literal('file'),
  data: z.string(),
  mediaType: z.string(),
});

/**
 * Schema unificado para partes de mensaje (discriminated union por `type`).
 *
 * TIPOS SOPORTADOS:
 *   - 'text'  → Contenido textual del mensaje.
 *   - 'image' → Imagen para análisis visual (JPEG, PNG, WebP).
 *   - 'file'  → Archivo binario (PDF, audio) en base64.
 *
 * Usar `discriminatedUnion` en lugar de `union` mejora performance y
 * la calidad de los mensajes de error de validación.
 */
export const messagePartSchema = z.discriminatedUnion('type', [
  textPartSchema,
  imagePartSchema,
  filePartSchema,
]);

// ============================================================
// SCHEMAS DE CONTENIDO Y MENSAJE
// ============================================================

/**
 * Schema para contenido de mensaje en formato objeto (con partes explícitas).
 * Alternativa al string plano cuando el mensaje tiene contenido multimodal.
 */
const contentObjectSchema = z.object({
  parts: z.array(messagePartSchema).optional(),
  text: z.string().optional(),
});

/**
 * Schema para el contenido de un mensaje.
 *
 * Acepta dos formatos:
 *   - String plano (máx 10KB): para mensajes de texto simples.
 *   - Objeto con `parts`: para mensajes multimodales (texto + imagen, etc.).
 *
 * NO transforma el contenido — la sanitización se hace en `sanitizeForModel`.
 */
const messageContentSchema = z.union([
  z.string().max(10000, 'Mensaje demasiado largo (max 10KB)'),
  contentObjectSchema,
]);

/**
 * Schema para un mensaje individual del historial de chat.
 *
 * CAMPOS NOTABLES:
 *   - `role`      → Solo acepta 'user', 'assistant', 'system'. No permite roles custom.
 *   - `content`   → Opcional con default '' para compatibilidad con tool messages vacíos.
 *   - `parts`     → `.catch(undefined)` ignora partes con formato inválido (degradación graceful).
 *   - `createdAt` → Acepta Date o string ISO y lo normaliza a Date con `z.preprocess`.
 */
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: messageContentSchema.optional().default(''),
  parts: z.array(messagePartSchema).optional().catch(undefined),
  id: z.string().optional(),
  createdAt: z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return undefined;
  }, z.date().optional()),
});

// ============================================================
// SCHEMA PRINCIPAL DEL REQUEST
// ============================================================

/**
 * Valores de modelos permitidos (extraídos de la config para el enum Zod).
 * Zod requiere al menos un valor en el tuple (`[string, ...string[]]`).
 */
const allowedModelValues = AVAILABLE_MODELS.map((m) => m.value) as [string, ...string[]];

/**
 * Schema principal para validar el body del endpoint POST /api/chat.
 *
 * LÍMITES:
 *   - `messages`: 1-100 mensajes. Mínimo 1 para que haya algo que procesar.
 *     Máximo 100 como protección contra payloads abusivos (DoS, quota exhaustion).
 *   - `model`: debe ser uno de los modelos en `AVAILABLE_MODELS` (lista blanca).
 *     Default al modelo configurado en `DEFAULT_MODEL` si se omite.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, 'Se requiere al menos un mensaje')
    .max(100, 'Demasiados mensajes (max 100)'),
  model: z.enum(allowedModelValues).optional().default(DEFAULT_MODEL),
});

// ============================================================
// TIPOS INFERIDOS
// ============================================================

/** Una parte individual de un mensaje multimodal (texto, imagen o archivo). */
export type MessagePart = z.infer<typeof messagePartSchema>;

/** Un mensaje del historial de chat con rol, contenido y partes opcionales. */
export type Message = z.infer<typeof messageSchema>;

/** Body validado del endpoint POST /api/chat. */
export type ChatRequest = z.infer<typeof chatRequestSchema>;
