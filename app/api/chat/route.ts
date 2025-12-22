import { createGroq } from '@ai-sdk/groq';
import { streamText, convertToModelMessages } from 'ai';
import { NextResponse } from 'next/server';
import { SYSTEM_PROMPT, STREAM_CONFIG } from '@/app/config';
import { env } from '@/app/config/env';
import { chatRateLimiter } from '@/app/lib/rate-limiter';
import { logger } from '@/app/lib/logger';
import { ERROR_MESSAGES } from '@/app/constants/messages';
import { chatRequestSchema } from '@/app/lib/schemas';
import { sanitizeMessages } from '@/app/lib/chat-utils';
import { extractClientIP, createInvalidIPResponse } from '@/app/lib/ip-utils';

// ===========================================
// Constants
// ===========================================

/**
 * Tiempo máximo permitido para respuestas streaming (segundos)
 * @see https://vercel.com/docs/functions/runtimes#max-duration
 */
export const maxDuration = 30;

// ===========================================
// Module Initialization
// ===========================================

/**
 * Cliente GROQ inicializado con API key del entorno
 */
const groq = createGroq({
  apiKey: env.GROQ_API_KEY,
});

// ===========================================
// Helper Functions
// ===========================================

/**
 * Crea respuesta de rate limit excedido
 *
 * @param retryAfterSeconds - Segundos hasta que se pueda reintentar
 * @returns NextResponse con status 429
 */
function createRateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.RATE_LIMIT,
      message: ERROR_MESSAGES.QUOTA_EXCEEDED_DESCRIPTION,
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

/**
 * Crea respuesta de error de validación
 *
 * @param details - Detalles del error (issues de Zod)
 * @returns NextResponse con status 400
 */
function createValidationErrorResponse(details: unknown): NextResponse {
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.INVALID_REQUEST,
      details,
    },
    { status: 400 }
  );
}

// ===========================================
// Route Handler
// ===========================================

/**
 * Procesa mensajes de chat y retorna respuesta streamed de IA
 *
 * @param req - Request HTTP con body JSON conteniendo messages y model opcional
 * @returns Stream de respuesta de IA o error JSON
 *
 * @throws {Error} Si hay error de procesamiento interno
 *
 * @example
 * ```bash
 * curl -X POST /api/chat \
 *   -H "Content-Type: application/json" \
 *   -d '{"messages": [{"role": "user", "content": "Hola"}]}'
 * ```
 */
export async function POST(req: Request): Promise<NextResponse | Response> {
  try {
    // 1. Validate client IP and apply rate limiting
    const clientIP = extractClientIP(req, {
      allowLocalhost: env.NODE_ENV === 'development',
    });

    // En producción, rechazar requests sin IP válida
    if (!clientIP) {
      return createInvalidIPResponse();
    }

    if (!chatRateLimiter.checkLimit(clientIP)) {
      const retryAfter = Math.ceil(chatRateLimiter.getRetryAfter(clientIP) / 1000);
      return createRateLimitResponse(retryAfter);
    }

    // 2. Parse JSON body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // 3. Validate request with Zod schema
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error.issues);
    }

    const { messages: rawMessages, model } = parseResult.data;

    // 4. Sanitize messages for AI processing
    const sanitizedMessages = sanitizeMessages(rawMessages);

    // 5. Stream AI response
    const result = streamText({
      model: groq(model),
      messages: convertToModelMessages(sanitizedMessages),
      system: SYSTEM_PROMPT,
    });

    return result.toUIMessageStreamResponse({
      sendSources: STREAM_CONFIG.sendSources,
      sendReasoning: STREAM_CONFIG.sendReasoning,
    });
  } catch (error) {
    // Log error with context
    logger.error(
      'Error en API de chat',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'ChatAPIRoute',
        action: 'POST',
      }
    );

    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN;

    return NextResponse.json(
      { error: ERROR_MESSAGES.PROCESSING_ERROR, details: errorMessage },
      { status: 500 }
    );
  }
}
