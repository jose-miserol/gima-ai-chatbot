/**
 * @file route.ts
 * @module app/api/chat
 *
 * ============================================================
 * ROUTE HANDLER — ENDPOINT PRINCIPAL DEL CHAT IA (POST /api/chat)
 * ============================================================
 *
 * QUÉ HACE ESTE ARCHIVO:
 *   Es el punto de entrada HTTP de toda la funcionalidad de chat del sistema GIMA.
 *   Recibe los mensajes del usuario desde el cliente, los procesa a través del
 *   ChatService y retorna una respuesta en streaming (Server-Sent Events) generada
 *   por el modelo de IA (Llama 3.3 70B vía GROQ).
 *
 * CONTEXTO EN GIMA:
 *   Este endpoint es invocado por el hook `useChat` del SDK de Vercel AI en el
 *   componente de chat. Cada vez que el técnico o ingeniero envía un mensaje,
 *   el navegador hace un POST aquí y recibe la respuesta palabra por palabra
 *   en tiempo real (streaming), lo que da la sensación de que la IA "escribe".
 *
 * FLUJO COMPLETO DE UNA REQUEST:
 *   [Navegador] POST /api/chat
 *   1. Validar IP del cliente (seguridad anti-abuso)
 *   2. Parsear JSON del body
 *   3. Verificar/renovar token de sesión con el backend Laravel (Silent Login)
 *   4. ChatService.processMessage() → llama a GROQ con herramientas del sistema
 *   5. Retornar stream de respuesta al navegador
 *
 * POR QUÉ maxDuration = 60:
 *   Vercel tiene un límite de 10s para Serverless Functions por defecto.
 *   Las respuestas de streaming de IA pueden tardar 30-60 segundos para
 *   respuestas largas. `maxDuration = 60` extiende este límite explícitamente.
 *   Ver: https://vercel.com/docs/functions/runtimes#max-duration
 *
 * MANEJO DE ERRORES:
 *   Los errores se mapean a códigos HTTP estándar:
 *   - 400 → JSON malformado o request inválida (ValidationError)
 *   - 429 → Rate limit excedido (RateLimitError) con header Retry-After
 *   - 500 → Error interno inesperado
 *
 * DÓNDE SE CONSUME:
 *   - Hook useChat() en app/components/features/chat/hooks/
 *   - Directamente vía fetch() en tests de integración
 * ============================================================
 */

import { NextResponse } from 'next/server';
import { getAuthToken, loginSilent } from '@/app/actions/auth';

// Ver documentación completa en app/actions/auth.ts.
// IMPORTANTE: Este bloque NUNCA se ejecuta en producción (NODE_ENV !== 'development').
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Configuración de streaming: define si se envían fuentes y razonamiento al cliente.
// sendSources: false → no expone las URLs que consultó la IA.
// sendReasoning: false → no transmite el "chain of thought" interno del modelo.
import { STREAM_CONFIG } from '@/app/config';

// Variables de entorno validadas con Zod (tipado seguro).
// env.NODE_ENV se usa para determinar si se permite localhost como IP válida.
import { env } from '@/app/config/env';

// Mensajes de error centralizados. Se importan desde constantes para
// evitar strings duplicados y facilitar internacionalización futura.
import { ERROR_MESSAGES } from '@/app/constants/messages';

// Utilidades para extracción y validación de IP del cliente.
// extractClientIP maneja headers de proxies (X-Forwarded-For, CF-Connecting-IP).
import { extractClientIP, createInvalidIPResponse } from '@/app/lib/ip-utils';

// Logger estructurado del proyecto.
import { logger } from '@/app/lib/logger';

// ChatService: orquesta toda la lógica de procesamiento de mensajes.
// RateLimitError y ValidationError son errores tipados que se mapean a HTTP 429/400.
import { ChatService, RateLimitError, ValidationError } from '@/app/lib/services/chat-service';

// ===========================================
// CONFIGURACIÓN DEL ROUTE HANDLER
// ===========================================

/**
 * Tiempo máximo permitido para respuestas streaming en Vercel.
 *
 * QUÉ ES: Variable especial exportada que Vercel lee para configurar
 *          el timeout de esta función serverless.
 * POR QUÉ 60: Las respuestas de IA con herramientas (tool calls al backend)
 *             pueden tardar hasta 60s: generación (≈20s) + llamadas API (≈30s).
 * DOCUMENTACIÓN: https://vercel.com/docs/functions/runtimes#max-duration
 */
export const maxDuration = 80;

// ===========================================
// HELPERS DE RESPUESTA DE ERROR
// ===========================================

/**
 * Crea una respuesta HTTP 429 (Too Many Requests) para rate limit excedido.
 *
 * QUÉ HACE:
 *   Construye un NextResponse con los headers estándar de rate limiting
 *   para que el cliente sepa cuándo puede reintentar.
 *
 * POR QUÉ HEADERS Retry-After Y X-RateLimit-Remaining:
 * - ESTÁNDAR HTTP (RFC 6585): Son la forma universal de manejar errores
 * 429 (Too Many Requests). 'Retry-After' indica los segundos a esperar,
 * y 'X-RateLimit-Remaining' las peticiones que te quedan.
 * - BACKOFF: Le dicen al cliente exactamente cuánto tiempo debe pausar
 * sus peticiones (hacer backoff) en lugar de saturar al servidor.
 * - FRONTEND (useChat): Hooks como useChat leen estos headers
 * automáticamente. Esto permite mostrar al usuario un mensaje preciso
 * como "Intenta de nuevo en 30 segundos" sin programar esa lógica a mano.
 *
 * @param retryAfterSeconds - Segundos que el cliente debe esperar antes de reintentar.
 *                            Viene del RateLimitError lanzado por ChatService.
 */
function createRateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.RATE_LIMIT, // "Too Many Requests"
      message: ERROR_MESSAGES.QUOTA_EXCEEDED_DESCRIPTION, // Descripción amigable para el usuario
      retryAfter: retryAfterSeconds, // También en body para clientes que no leen headers
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(), // Estándar HTTP para indicar cuándo reintentar
        'X-RateLimit-Remaining': '0', // El cliente sabe que no quedan requests disponibles
      },
    }
  );
}

/**
 * Crea una respuesta HTTP 400 (Bad Request) para errores de validación.
 *
 * QUÉ HACE:
 *   Construye un NextResponse con los detalles del error de validación
 *   de Zod para que el cliente pueda mostrar mensajes específicos.
 *
 * POR QUÉ `details: unknown`:
 *   Los issues de Zod tienen estructura compleja. Se pasan directamente
 *   sin tipar para evitar duplicar la definición del tipo de error de Zod.
 *   El cliente puede ignorar los detalles o mostrarlos en modo debug.
 *
 * @param details - Objeto con los issues de validación de Zod.
 */
function createValidationErrorResponse(details: unknown): NextResponse {
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.INVALID_REQUEST, // "Invalid request format"
      details, // Issues específicos de Zod para debugging
    },
    { status: 400 }
  );
}

// ===========================================
// ROUTE HANDLER PRINCIPAL
// ===========================================

/**
 * Maneja las peticiones POST al endpoint /api/chat.
 *
 * QUÉ HACE:
 *   Orquesta todo el flujo de procesamiento de mensajes de chat:
 *   valida la IP, parsea el body, renueva la sesión si es necesario,
 *   delega al ChatService y retorna la respuesta en streaming.
 *
 * CÓMO FUNCIONA (paso a paso):
 *
 *   PASO 1 — Validar IP del cliente:
 *     Extrae la IP del request (soporta proxies con X-Forwarded-For).
 *     En desarrollo se permite `127.0.0.1` / `localhost`.
 *     Si la IP es inválida o no se puede extraer, retorna 400 inmediatamente.
 *     POR QUÉ: Previene abuso anónimo y permite rate limiting por IP.
 *
 *   PASO 2 — Parsear JSON:
 *     Intenta parsear el body como JSON. Si falla (body vacío, malformado),
 *     retorna 400 sin llegar al ChatService.
 *     POR QUÉ separado de la validación de schema: el ChatService valida
 *     la estructura del mensaje (campos, tipos), aquí solo verificamos
 *     que sea JSON parseable.
 *
 *   PASO 2.5 — Verificar/renovar token de sesión (Silent Login):
 *     Intenta leer el token Sanctum de las cookies.
 *     Si no existe (primera visita, sesión expirada), llama a loginSilent()
 *     para autenticarse automáticamente con el backend Laravel.
 *     POR QUÉ "2.5": Es un paso intermedio de soporte que no bloquea el flujo
 *     principal — si el login falla, el chat continúa pero las herramientas
 *     que consultan el backend GIMA pueden retornar errores de autenticación.
 *
 *   PASO 3 — Procesar con ChatService:
 *     ChatService.processMessage() hace todo el trabajo pesado:
 *     - Valida el schema del request con Zod
 *     - Aplica rate limiting por IP
 *     - Construye los mensajes con el system prompt de GIMA
 *     - Llama a GROQ con las herramientas (consultar_activos, etc.)
 *     - Retorna un StreamingTextResponse
 *
 *   PASO 4 — Convertir stream a respuesta HTTP:
 *     `toUIMessageStreamResponse()` convierte el stream interno del SDK
 *     al formato Server-Sent Events que espera el hook useChat del cliente.
 *     sendSources y sendReasoning vienen de STREAM_CONFIG en app/config.
 *
 *   PASO 5 — Manejo de errores tipados:
 *     RateLimitError → 429 con Retry-After
 *     ValidationError → 400 con detalles de Zod
 *     Error genérico → 500 con mensaje sanitizado (sin stack trace)
 *
 * QUIÉN LA LLAMA:
 *   Next.js App Router la registra automáticamente como handler de POST
 *   en la ruta /api/chat (por convención de nombre de archivo).
 *   El cliente la invoca a través del hook useChat del SDK de Vercel AI.
 *
 * @param req - Request HTTP estándar de la Web API (no NextRequest).
 *              Se usa `Request` en lugar de `NextRequest` porque el streaming
 *              funciona mejor con el tipo base en Next.js 15.
 * @returns StreamingResponse (éxito) o NextResponse con error JSON.
 *
 */
export async function POST(req: Request): Promise<NextResponse | Response> {
  // -------------------------------------------------------------------
  // PASO 1: Validar IP del cliente
  // -------------------------------------------------------------------
  // extractClientIP lee en orden: CF-Connecting-IP → X-Forwarded-For → RemoteAddr
  // allowLocalhost: true en desarrollo permite probar desde 127.0.0.1
  const clientIP = extractClientIP(req, {
    allowLocalhost: env.NODE_ENV === 'development',
  });

  if (!clientIP) {
    // IP inválida o no extraíble → createInvalidIPResponse retorna 400 con mensaje estándar
    return createInvalidIPResponse();
  }

  // -------------------------------------------------------------------
  // PASO 2: Parsear JSON del body
  // -------------------------------------------------------------------
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    // body vacío, malformado o Content-Type incorrecto
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  // -------------------------------------------------------------------
  // PASO 2.5: Verificar/renovar token de sesión (Silent Login)
  // -------------------------------------------------------------------
  // getAuthToken lee la cookie HTTP-only 'auth_token'.
  // Si no existe, loginSilent() hace POST automático al backend Laravel
  // y guarda el nuevo token en la cookie para las llamadas a herramientas de GIMA.
  const currentToken = await getAuthToken();
  if (!currentToken) {
    logger.info('No hay token de sesión, intentando login automático (Silent Login).', {
      component: 'ChatAPIRoute',
    });
    const loginSuccess = await loginSilent();
    if (!loginSuccess) {
      // El login falló (backend caído, credenciales inválidas, etc.)
      // No se bloquea el flujo: el chat puede responder preguntas generales,
      // pero las herramientas que consultan el backend GIMA retornarán 401.
      logger.warn(
        'El login automático falló. La sesión continuará pero puede tener errores de red con la IA.',
        {
          component: 'ChatAPIRoute',
        }
      );
    }
  }

  // -------------------------------------------------------------------
  // PASO 3 y 4: Procesar mensaje y retornar stream
  // -------------------------------------------------------------------
  try {
    // ChatService encapsula: validación Zod, rate limiting, tool calling, y streaming.
    // Se instancia por request (no singleton) para evitar estado compartido entre usuarios.
    const chatService = new ChatService();
    const result = await chatService.processMessage(rawBody, clientIP);

    // Convierte el stream interno del Vercel AI SDK al formato SSE que espera useChat().
    // sendSources: false → no incluye citaciones de búsqueda web en el stream.
    // sendReasoning: false → no incluye el chain-of-thought del modelo (reduce tokens enviados).
    return result.toUIMessageStreamResponse({
      sendSources: STREAM_CONFIG.sendSources,
      sendReasoning: STREAM_CONFIG.sendReasoning,
    });
  } catch (error) {
    // -------------------------------------------------------------------
    // PASO 5: Mapear errores específicos a respuestas HTTP apropiadas
    // -------------------------------------------------------------------

    // Rate limit excedido: ChatService lanza RateLimitError con el tiempo de espera.
    // Se retorna 429 con el header Retry-After para que el cliente pueda hacer backoff.
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error.retryAfter);
    }

    // Error de validación de schema: el body no cumple el formato esperado.
    // Se retorna 400 con los detalles de Zod para debugging en el cliente.
    if (error instanceof ValidationError) {
      return createValidationErrorResponse(error.details);
    }

    // Error genérico inesperado (error de red, timeout de GROQ, etc.)
    // Se loguea el error completo en el servidor pero solo se expone
    // el mensaje sanitizado al cliente (sin stack trace por seguridad).

    // Detectar rate limit de GROQ (viene como Error genérico del SDK, no como RateLimitError).
    // El mensaje contiene "Rate limit" o "429" cuando GROQ rechaza por TPM excedido.
    const errorMsg = error instanceof Error ? error.message : '';
    if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('429')) {
      logger.warn('GROQ rate limit detectado', {
        component: 'ChatAPIRoute',
        action: 'POST',
        errorMessage: errorMsg,
      });
      // Extraer segundos de espera del mensaje de GROQ (ej: "try again in 40.74s")
      const retryMatch = errorMsg.match(/try again in ([\d.]+)s/i);
      const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      return createRateLimitResponse(retryAfter);
    }

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
