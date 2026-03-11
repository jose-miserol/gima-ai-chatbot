/**
 * @file chat-service.ts
 * @module app/lib/services/chat-service
 *
 * ============================================================
 * SERVICIO — PROCESAMIENTO DE MENSAJES DEL CHAT DE IA
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `ChatService`, la clase que centraliza toda la lógica del
 *   endpoint de chat de GIMA. Dada una petición HTTP cruda, este servicio:
 *     1. Aplica rate limiting por IP para prevenir abuso.
 *     2. Valida la estructura del body con el schema Zod del chat.
 *     3. Sanitiza los mensajes para el modelo (limpia partes binarias).
 *     4. Limita el historial a los últimos N mensajes (presupuesto de tokens).
 *     5. Invoca el LLM con las tools del chat y retorna el stream.
 *
 *   También define los errores personalizados `RateLimitError` y
 *   `ValidationError` que el Route Handler usa para construir respuestas HTTP.
 *
 * CONTEXTO EN GIMA:
 *   El chat es la interfaz principal de IA para los técnicos: pueden preguntar
 *   sobre activos, mantenimientos, inventario y recibir datos en tiempo real
 *   gracias a las chat tools que consultan el backend de Laravel.
 *   Este servicio separa la lógica del Route Handler (`POST /api/chat`)
 *   para que ambos sean testables de forma independiente.
 *
 * POR QUÉ GROQ Y NO GEMINI PARA EL CHAT:
 *   GROQ ofrece inferencia extremadamente rápida (Time-To-First-Token < 200ms)
 *   con modelos Llama, lo que es crítico para una experiencia de chat fluida.
 *   Gemini se usa para las features multimodales (vision, audio, PDF) donde
 *   su ventaja de contexto 1M tokens es relevante. El chat solo necesita
 *   velocidad.
 *
 * POR QUÉ `streamText` Y NO `generateText`:
 *   Las respuestas del chat pueden ser extensas (ej. "Muéstrame todos los
 *   activos en mantenimiento"). Con `streamText`, el primer token llega al
 *   navegador en ~200ms, dando feedback visual inmediato al usuario mientras
 *   el modelo genera el resto. `generateText` bloquearía hasta tener la
 *   respuesta completa.
 *
 * GESTIÓN DEL HISTORIAL (MAX_HISTORY_MESSAGES):
 *   GROQ con llama-3.1-8b-instant tiene un límite de ~6000 TPM (tokens por
 *   minuto). Enviar el historial completo de una conversación larga agotaría
 *   ese límite en pocas peticiones. Se mantienen solo los últimos 6 mensajes
 *   como balance entre contexto suficiente y consumo de tokens.
 *
 * INYECCIÓN DE DEPENDENCIAS:
 *   Las tres dependencias clave (logger, rateLimiter, modelProvider) son
 *   inyectables para tests. En producción se usan los singletons globales.
 *
 * ERRORES EXPORTADOS:
 *   - RateLimitError   → El IP superó el límite de requests. Incluye `retryAfter` en segundos.
 *   - ValidationError  → El body no cumple el schema del chat. Incluye `details` de Zod.
 *
 */

import { createGroq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { streamText, stepCountIs, type LanguageModel } from 'ai';

import { sanitizeForModel } from '@/app/components/features/chat/utils';
import { SYSTEM_PROMPT } from '@/app/config';
import { env } from '@/app/config/env';
import { ERROR_MESSAGES } from '@/app/constants/messages';
import { chatTools } from '@/app/lib/ai/tools/chat-tools';
import { logger } from '@/app/lib/logger';
import { chatRateLimiter } from '@/app/lib/rate-limiter';
import { chatRequestSchema } from '@/app/lib/schemas';

// ============================================================
// INTERFACES DE DEPENDENCIAS
// ============================================================

/**
 * Dependencias inyectables del ChatService.
 *
 * En producción se usan los defaults. En tests se inyectan doubles
 * para verificar comportamiento sin llamadas reales al LLM o al rate limiter.
 *
 * @property logger         - Logger estructurado del proyecto.
 * @property rateLimiter    - Rate limiter con ventana deslizante por IP.
 * @property modelProvider  - Factory que retorna un LanguageModel dado su ID.
 *                            En producción es el cliente GROQ configurado con la API key.
 */
export interface ChatServiceDependencies {
  logger: typeof logger;
  rateLimiter: typeof chatRateLimiter;
  modelProvider: (modelId: string) => LanguageModel;
}

// ============================================================
// SERVICIO: ChatService
// ============================================================

/**
 * Servicio de procesamiento del chat de IA.
 *
 * Separa la lógica de negocio del Route Handler HTTP, haciendo
 * ambos componentes más testables y mantenibles.
 *
 * @example
 * ```typescript
 * // En el Route Handler:
 * const service = new ChatService();
 * const result = await service.processMessage(body, clientIP);
 * return result.toDataStreamResponse();
 * ```
 */
export class ChatService {
  private deps: ChatServiceDependencies;

  /**
   * @param dependencies - Dependencias opcionales. Usa defaults de producción si se omiten.
   */
  constructor(dependencies: Partial<ChatServiceDependencies> = {}) {
    this.deps = {
      logger: dependencies.logger || logger,
      rateLimiter: dependencies.rateLimiter || chatRateLimiter,
      modelProvider:
        dependencies.modelProvider ||
        ((modelId: string) => {
          if (modelId.startsWith('google:')) {
            return google(modelId.replace('google:', ''));
          }
          return createGroq({ apiKey: env.GROQ_API_KEY })(modelId);
        }),
    };
  }

  /**
   * Procesa un mensaje de chat y retorna el stream de la respuesta del LLM.
   *
   * QUÉ HACE (paso a paso):
   *   1. Rate limiting por IP: rechaza si el cliente superó el límite.
   *   2. Validación del body: verifica estructura con chatRequestSchema.
   *   3. Sanitización: limpia partes binarias (imágenes, archivos) del historial.
   *   4. Truncado de historial: mantiene solo los últimos 6 mensajes.
   *   5. Streaming: invoca el LLM con las chat tools de GIMA y retorna el stream.
   *
   * MANEJO DE ERRORES:
   *   - RateLimitError → el Route Handler responde 429 con Retry-After.
   *   - ValidationError → el Route Handler responde 400 con detalles de Zod.
   *   - Rate limit de GROQ (429) → se loguea como warning (estado esperado,
   *     no un bug del sistema) y se propaga para que el Route Handler responda 429.
   *
   * @param rawBody  - Body parseado del Request HTTP (puede ser cualquier estructura).
   * @param clientIP - IP del cliente para rate limiting. Null si no está disponible.
   * @returns El resultado de `streamText` listo para convertir en DataStreamResponse.
   * @throws RateLimitError si el IP superó el límite de peticiones.
   * @throws ValidationError si el body no cumple el schema del chat.
   */
  async processMessage(rawBody: unknown, clientIP: string | null) {
    // Paso 1: Rate limiting por IP.
    // Se comprueba antes de cualquier procesamiento para abortar cuanto antes
    // y no consumir recursos del servidor en requests abusivos.
    if (clientIP && !this.deps.rateLimiter.checkLimit(clientIP)) {
      const retryAfter = Math.ceil(this.deps.rateLimiter.getRetryAfter(clientIP) / 1000);
      throw new RateLimitError(retryAfter);
    }

    // Paso 2: Validación del body con schema Zod.
    // chatRequestSchema valida estructura, límites de mensajes y modelo permitido.
    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues);
    }

    const { messages: rawMessages, model } = parseResult.data;

    // Paso 3: Sanitización de mensajes.
    // sanitizeForModel elimina partes binarias (base64 de imágenes/archivos) del
    // historial para no saturar el contexto del modelo con datos no textuales.
    // Se pasan los mensajes crudos del body original porque Zod puede descartar
    // partes tool_result que son necesarias para generar resúmenes ligeros.
    const rawBodyMessages = (rawBody as { messages?: unknown[] })?.messages;
    const messages = sanitizeForModel(
      rawMessages,
      Array.isArray(rawBodyMessages)
        ? (rawBodyMessages as { role?: string; content?: unknown; parts?: unknown[] }[])
        : undefined
    );

    // Paso 4: Truncado del historial.
    // Limitar a los últimos 6 mensajes reduce el consumo de tokens respetando
    // el límite de 6000 TPM de GROQ con llama-3.1-8b-instant.
    const MAX_HISTORY_MESSAGES = 6;
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);

    // Paso 5: Generación de respuesta en streaming.
    try {
      const result = streamText({
        model: this.deps.modelProvider(model),
        messages: recentMessages,
        system: SYSTEM_PROMPT,
        tools: chatTools,
        // stopWhen: limita a 2 pasos (1 tool call + 1 respuesta final)
        // para prevenir loops de tools infinitos y controlar el costo.
        stopWhen: stepCountIs(2),
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRateLimit = errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429');

      if (isRateLimit) {
        // Rate limit de GROQ: estado esperado en horas pico, no un error del sistema.
        // Se loguea como `warn` (no `error`) para no generar alertas falsas en Sentry.
        this.deps.logger.warn(
          'Rate limit de GROQ alcanzado. El usuario debe esperar unos segundos.',
          {
            component: 'ChatService',
            action: 'processMessage',
            errorMessage: errorMsg,
          }
        );
      } else {
        this.deps.logger.error(
          'Error generando respuesta AI',
          error instanceof Error ? error : new Error(errorMsg),
          { component: 'ChatService', action: 'processMessage' }
        );
      }
      throw error;
    }
  }
}

// ============================================================
// ERRORES PERSONALIZADOS
// ============================================================

/**
 * Error de rate limit del chat.
 *
 * Se lanza cuando el IP del cliente superó el límite de peticiones
 * configurado en `chatRateLimiter`. El Route Handler lo convierte en
 * una respuesta HTTP 429 con el header `Retry-After`.
 *
 * @property retryAfter - Segundos que el cliente debe esperar antes de reintentar.
 */
export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(ERROR_MESSAGES.RATE_LIMIT);
    this.name = 'RateLimitError';
  }
}

/**
 * Error de validación del body del chat.
 *
 * Se lanza cuando el body del request no cumple con `chatRequestSchema`.
 * El Route Handler lo convierte en una respuesta HTTP 400 con los detalles
 * de los campos que fallaron la validación.
 *
 * @property details - Array de ZodIssue con el path y mensaje de cada error.
 */
export class ValidationError extends Error {
  constructor(public details: unknown) {
    super(ERROR_MESSAGES.INVALID_REQUEST);
    this.name = 'ValidationError';
  }
}
