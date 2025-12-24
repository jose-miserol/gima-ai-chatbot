import { NextResponse } from 'next/server';
import { STREAM_CONFIG } from '@/app/config';
import { env } from '@/app/config/env';
import { logger } from '@/app/lib/logger';
import { ERROR_MESSAGES } from '@/app/constants/messages';
import { extractClientIP, createInvalidIPResponse } from '@/app/lib/ip-utils';
import { ChatService, RateLimitError, ValidationError } from '@/app/lib/services/chat-service';

// ===========================================
// Constants
// ===========================================

/**
 * Tiempo máximo permitido para respuestas streaming (segundos)
 * @see https://vercel.com/docs/functions/runtimes#max-duration
 */
export const maxDuration = 30;

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
  // 1. Validate client IP
  const clientIP = extractClientIP(req, {
    allowLocalhost: env.NODE_ENV === 'development',
  });

  if (!clientIP) {
    return createInvalidIPResponse();
  }

  // 2. Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  // 3. Process with ChatService
  try {
    const chatService = new ChatService();
    const result = await chatService.processMessage(rawBody, clientIP);

    return result.toUIMessageStreamResponse({
      sendSources: STREAM_CONFIG.sendSources,
      sendReasoning: STREAM_CONFIG.sendReasoning,
    });
  } catch (error) {
    // 4. Map specific errors to HTTP responses
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error.retryAfter);
    }

    if (error instanceof ValidationError) {
      return createValidationErrorResponse(error.details);
    }

    // 5. Generic error handling
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
