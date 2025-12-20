import { createGroq } from '@ai-sdk/groq';
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { SYSTEM_PROMPT, STREAM_CONFIG, DEFAULT_MODEL } from '@/app/config';
import { env } from '@/app/config/env';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { RawMessage, SanitizedMessage } from '@/app/types/chat.types';
import { chatRateLimiter } from '@/app/lib/rate-limiter';

// Allow streaming responses up to 30 seconds
// Note: Must be a literal value for Next.js static analysis
export const maxDuration = 30;

// Initialize GROQ
const groq = createGroq({
  apiKey: env.GROQ_API_KEY,
});

// Zod schema for request validation
const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z
        .union([z.string(), z.any()]) // Permitir objetos para sanitizar
        .transform((val) => (typeof val === 'string' ? val : JSON.stringify(val)))
        .pipe(z.string().max(10000, 'Mensaje demasiado largo (max 10KB)')),
      parts: z.array(z.any()).optional(),
      id: z.string().optional(),
      createdAt: z
        .union([z.date(), z.string()])
        .optional()
        .transform((val) => (typeof val === 'string' ? new Date(val) : val)),
    })
  ),
  model: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Check rate limit
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    if (!chatRateLimiter.checkLimit(ip)) {
      const retryAfter = Math.ceil(chatRateLimiter.getRetryAfter(ip) / 1000);
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Has excedido el límite de solicitudes. Intenta nuevamente en unos segundos.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = requestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { messages: rawMessages, model = DEFAULT_MODEL } = parseResult.data;

    // Sanitize messages to ensure content is always a string
    // This handles cases where vision analysis messages might have incorrect format
    const sanitizedMessages = rawMessages.map((msg: RawMessage): SanitizedMessage => {
      let content = msg.content;

      // If content is missing or not a string, try to extract from parts
      if (typeof content !== 'string') {
        const textPart = msg.parts?.find(
          (p): p is { type: string; text: string } =>
            p.type === 'text' && typeof p.text === 'string'
        );
        content = textPart?.text || '';
      }

      return {
        ...msg,
        content: String(content || ''),
        createdAt: msg.createdAt instanceof Date ? msg.createdAt : undefined,
      };
    }) as UIMessage[];

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
    console.error('Error en API de chat:', error);

    // Better error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Error al procesar la solicitud', details: errorMessage },
      { status: 500 }
    );
  }
}
