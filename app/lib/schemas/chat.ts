/**
 * Chat API Schemas - Validación centralizada con Zod
 *
 * Este módulo define todos los schemas de validación para el API de chat.
 * La validación solo verifica estructura, NO transforma datos.
 * La transformación se maneja en chat-utils.ts
 */

import { z } from 'zod';

import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/app/config';

// ============================================
// Message Part Schemas
// ============================================

/**
 * Schema para partes de texto
 */
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/**
 * Schema para partes de imagen
 */
const imagePartSchema = z.object({
  type: z.literal('image'),
  imageUrl: z.string().url(),
  mimeType: z.string(),
});

/**
 * Schema para partes de archivo
 */
const filePartSchema = z.object({
  type: z.literal('file'),
  data: z.string(),
  mediaType: z.string(),
});

/**
 * Schema unificado para partes de mensaje
 * Usa discriminatedUnion para mejor performance y mensajes de error
 */
export const messagePartSchema = z.discriminatedUnion('type', [
  textPartSchema,
  imagePartSchema,
  filePartSchema,
]);

// ============================================
// Content Schemas
// ============================================

/**
 * Schema para contenido que es un objeto con partes
 */
const contentObjectSchema = z.object({
  parts: z.array(messagePartSchema).optional(),
  text: z.string().optional(),
});

/**
 * Schema para contenido de mensaje (string o objeto con partes)
 * NO transforma - la sanitización se hace después
 */
const messageContentSchema = z.union([
  z.string().max(10000, 'Mensaje demasiado largo (max 10KB)'),
  contentObjectSchema,
]);

// ============================================
// Message Schema
// ============================================

/**
 * Schema para un mensaje individual
 * content es opcional - si no está presente, se usa string vacío
 * parts se ignora si tiene formato inválido (en lugar de fallar)
 */
export const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: messageContentSchema.optional().default(''),
  parts: z.array(messagePartSchema).optional().catch(undefined), // Ignore invalid parts
  id: z.string().optional(),
  createdAt: z.preprocess((val) => {
    if (val === undefined || val === null) return undefined;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return undefined;
  }, z.date().optional()),
});

// ============================================
// Request Schema
// ============================================

/**
 * Extrae los valores de modelos permitidos para el schema
 */
const allowedModelValues = AVAILABLE_MODELS.map((m) => m.value) as [string, ...string[]];

/**
 * Schema principal para validar requests del chat API
 * - Limita a 100 mensajes máximo (prevención DoS)
 * - Valida modelo contra lista blanca
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, 'Se requiere al menos un mensaje')
    .max(100, 'Demasiados mensajes (max 100)'),
  model: z.enum(allowedModelValues).optional().default(DEFAULT_MODEL),
});

// ============================================
// Inferred Types
// ============================================

export type MessagePart = z.infer<typeof messagePartSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
