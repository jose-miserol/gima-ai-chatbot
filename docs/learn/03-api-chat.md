# 03 — API del Chat (`api/chat/route.ts`)

> Es un Controlador de Interfaz de Programación de Aplicaciones (API Route o Endpoint) alojado y ejecutado exclusivamente en el lado del servidor de Next.js, funcionando como el "cerebro backend" que centraliza todo el tráfico de mensajes conversacionales. Sirve para orquestar un conducto completo de extremo a extremo: intercepta la solicitud del usuario (cuando presiona "Enviar"), ejecuta estrictos filtros de ciberseguridad (límite de peticiones por IP, limpieza de código malicioso, validaciones JSON), transmite el mensaje purificado de forma segura al proveedor de IA y, finalmente, implementa una conexión de transmisión continua (streaming SSE) para despachar sin retraso la respuesta del asistente de regreso al navegador web. Existe principalmente por una razón crítica de arquitectura y ciberseguridad: las credenciales privadas (API Keys) de GROQ y Google Gemini cuestan dinero y son altamente confidenciales. Si nos conectáramos a la IA directamente desde los componentes React en el navegador, cualquier persona inspeccionando la página podría robarlas; por tanto, este archivo conforma un muro protector ("servidor intermediario seguro") donde esos secretos nunca son accesibles para el cliente.

---

## 📍 Ubicación y Ruta

- **Archivo**: `app/api/chat/route.ts`
- **URL que genera**: `POST /api/chat`
- **Carpeta de tests**: `app/api/chat/__tests__/`

🧠 **Concepto — API Routes en Next.js**: En Next.js App Router, cualquier archivo llamado `route.ts` dentro de `app/api/` se convierte automáticamente en un endpoint HTTP. El nombre de la carpeta define la URL: `app/api/chat/route.ts` → `POST /api/chat`. No necesitas Express, Fastify, ni ningún otro framework — Next.js lo maneja por ti.

---

## 🔄 Flujo Completo del Endpoint — Paso a Paso

Este diagrama muestra qué pasa desde que el usuario presiona "Enviar" hasta que ve la respuesta:

```
Cliente (navegador)                    Servidor (Next.js)
       │                                     │
  1.   │── POST /api/chat ──────────────────>│
       │   Body: { messages, model }         │
       │                                     │
       │                              2. ¿IP válida? ──→ Si no: 403 Forbidden
       │                                     │
       │                              3. ¿JSON válido? ─→ Si no: 400 Bad Request
       │                                     │
       │                              4. ChatService.processMessage()
       │                                  ├── 4a. Rate limit ──→ Si excede: 429
       │                                  ├── 4b. Validar con Zod ──→ Si falla: 400
       │                                  ├── 4c. Sanitizar prompt
       │                                  └── 4d. streamText() → GROQ API
       │                                     │
  5.   │<── Stream de texto (SSE) ───────────│
       │  Palabra por palabra:               │
       │  "El" "equipo" "UMA" "presenta"...  │
       │                                     │
  6.   │  ✅ Respuesta completa mostrada     │
```

---

## 📄 Líneas Clave — Explicación Detallada

### Imports — Las Herramientas que Usa

```typescript
import { NextResponse } from 'next/server';
```

**¿Qué es?** `NextResponse` es la clase de Next.js para crear respuestas HTTP con headers, status codes, y body estructurado. Es como `res.json()` de Express pero más moderno y tipado.

**¿Para qué lo usa?** Para devolver respuestas de error (400, 429, 500) en formato JSON con headers apropiados.

```typescript
import { ChatService, RateLimitError, ValidationError } from '@/app/lib/services/chat-service';
```

**¿Qué es?** `ChatService` es la clase que contiene toda la lógica de procesamiento del chat. `RateLimitError` y `ValidationError` son clases de error personalizadas que el servicio lanza cuando algo sale mal.

**¿Por qué errores separados?** Porque cada tipo de error necesita una respuesta HTTP diferente. Un rate limit devuelve 429 con header `Retry-After`, mientras que un error de validación devuelve 400 con los detalles del problema.

```typescript
import { extractClientIP, createInvalidIPResponse } from '@/app/lib/ip-utils';
```

**¿Qué es?** Funciones utilitarias para extraer la dirección IP real del usuario desde los headers HTTP del request.

**¿Por qué necesitamos la IP?** Para el rate limiter. Cada IP tiene un límite de 20 mensajes por minuto. Sin la IP real, no podemos distinguir entre usuarios y un solo usuario podría agotar la cuota de la API.

**¿Por qué es complicado extraer la IP?** Porque cuando la app está detrás de un proxy o CDN (como Vercel, Cloudflare, o Nginx), la IP del usuario llega en headers como `X-Forwarded-For` o `X-Real-IP`, no en la conexión directa.

### La Constante `maxDuration`

```typescript
export const maxDuration = 30; // seconds
```

**¿Qué es?** Le dice a Vercel (o cualquier proveedor serverless) cuánto tiempo máximo puede ejecutarse esta función antes de ser terminada forzosamente.

**¿Por qué 30 segundos?** Porque los modelos de IA pueden tardar varios segundos en generar respuestas largas. El default de Vercel es 10 segundos, que puede ser insuficiente para respuestas complejas.

**¿Para qué sirve?** Si la IA se cuelga o tarda demasiado, este timeout la corta automáticamente en vez de dejarlo colgado indefinidamente (lo que costaría dinero y bloquearía al usuario).

---

### Paso 1 — Validar la IP del Cliente

```typescript
const clientIP = extractClientIP(req, {
  allowLocalhost: env.NODE_ENV === 'development',
});

if (!clientIP) {
  return createInvalidIPResponse();
}
```

**¿Qué hace?** Extrae la IP real del usuario desde los headers HTTP. En desarrollo, permite `localhost` (127.0.0.1). En producción, exige una IP real.

**¿Para qué?** La IP se usa después para el rate limiting. Si no podemos identificar al usuario, rechazamos la petición por seguridad.

**¿Por qué `allowLocalhost` solo en desarrollo?** Cuando programas localmente, tu IP es `127.0.0.1` o `::1`. En producción, estas IPs son sospechosas (podrían indicar un intento de bypass del rate limiter).

---

### Paso 2 — Parsear el Body JSON

```typescript
let rawBody: unknown;
try {
  rawBody = await req.json();
} catch {
  return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
}
```

**¿Qué hace?** Intenta leer el cuerpo del request como JSON. Si falla (por ejemplo, el body está vacío o mal formado), devuelve un error 400 inmediatamente.

**¿Por qué el tipo `unknown`?** En TypeScript, `unknown` es más seguro que `any`. Fuerza al programador a validar los datos antes de usarlos. No asumimos nada sobre la estructura del body hasta validarlo con Zod en el paso siguiente.

**¿Por qué un try/catch separado?** Para dar un mensaje de error específico ("JSON inválido") en vez del error genérico del paso 5. El usuario sabe exactamente qué arreglar.

---

### Paso 3 — Procesar con ChatService

```typescript
const chatService = new ChatService();
const result = await chatService.processMessage(rawBody, clientIP);

return result.toUIMessageStreamResponse({
  sendSources: STREAM_CONFIG.sendSources,
  sendReasoning: STREAM_CONFIG.sendReasoning,
});
```

**¿Qué hace?** Crea una instancia del `ChatService` y le pasa el body y la IP del cliente. El servicio internamente:

1. Verifica el rate limit (¿esta IP ha enviado más de 20 mensajes en 1 minuto?)
2. Valida los datos con Zod (¿el body tiene la estructura correcta?)
3. Sanitiza el prompt (¿hay intentos de inyección de prompts?)
4. Llama a GROQ con `streamText()` para generar la respuesta

**¿Qué es `toUIMessageStreamResponse()`?** Convierte el stream de la IA en un formato compatible con el hook `useChat` del frontend. El texto se envía en tiempo real usando Server-Sent Events (SSE), no todo de golpe.

🧠 **Concepto — Streaming vs Response completa**: Imagina pedir una pizza. **Sin streaming**: esperas 30 minutos y te traen toda la pizza de golpe. **Con streaming**: te van sirviendo cada porción conforme sale del horno. El usuario ve las palabras aparecer una por una, igual que en ChatGPT.

**¿Qué es `STREAM_CONFIG`?** Un objeto de configuración (definido en `config/server.ts`) que controla si se envían las fuentes citadas y el razonamiento interno de la IA. Actualmente ambos están desactivados.

---

### Paso 4 — Manejo de Errores Específicos

```typescript
if (error instanceof RateLimitError) {
  return createRateLimitResponse(error.retryAfter);
}
```

**¿Qué hace?** Si el `ChatService` lanza un `RateLimitError`, devolvemos un HTTP 429 (Too Many Requests) con el header `Retry-After` indicando cuántos segundos debe esperar el usuario.

**¿Por qué un tipo de error específico?** Porque HTTP define códigos de estado semánticos. Cada error tiene su código:

- **429** = "Estás haciendo peticiones demasiado rápido, espera un momento"
- **400** = "Los datos que enviaste no son válidos"
- **500** = "Algo se rompió en el servidor, no es tu culpa"

```typescript
if (error instanceof ValidationError) {
  return createValidationErrorResponse(error.details);
}
```

**¿Qué hace?** Si Zod rechaza el body (campos faltantes, tipos incorrectos, etc.), devolvemos 400 con los detalles específicos de qué validación falló. Así el frontend puede mostrar un mensaje descriptivo.

### Paso 5 — Error Genérico (Fallback)

```typescript
logger.error('Error en API de chat', error, {
  component: 'ChatAPIRoute',
  action: 'POST',
});

return NextResponse.json(
  { error: ERROR_MESSAGES.PROCESSING_ERROR, details: errorMessage },
  { status: 500 }
);
```

**¿Qué hace?** Para cualquier error no previsto (un bug, una API caída, un timeout inesperado), loggeamos el error completo (con stack trace) y devolvemos un 500 genérico al cliente.

**¿Por qué loggear antes de responder?** Porque el mensaje al usuario es genérico ("Error de procesamiento"). El log detallado es para el desarrollador que investiga el problema después. Sin el log, el error se perdería.

---

### Helper: `createRateLimitResponse()`

```typescript
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
```

**¿Qué es el header `Retry-After`?** Es un header estándar de HTTP (RFC 7231) que le dice al cliente cuántos segundos debe esperar antes de reintentar. Navegadores y clientes HTTP respetuosos leen este header automáticamente.

**¿Qué es `X-RateLimit-Remaining`?** Es un header no estándar (por eso la "X") pero convencional en APIs REST. Indica cuántas peticiones le quedan al cliente. En este caso, 0.

---

## 🧠 Conceptos Clave

### ¿Qué es un API Route en Next.js?

En frameworks tradicionales (Express, Flask), creas un archivo de rutas y las registras manualmente. En Next.js App Router, es automático:

```
Carpeta                    →  URL generada
app/api/chat/route.ts      →  POST /api/chat
app/api/users/route.ts     →  GET/POST /api/users
app/api/orders/[id]/route.ts → GET /api/orders/123
```

Solo necesitas exportar funciones con el nombre del método HTTP (`GET`, `POST`, `PUT`, `DELETE`).

### ¿Qué es SSE (Server-Sent Events)?

Es un protocolo web que permite al servidor enviar datos al cliente continuamente a través de una sola conexión HTTP. A diferencia de WebSockets (que son bidireccionales), SSE es unidireccional: solo del servidor al cliente. Es perfecto para streaming de texto de IA porque el cliente solo necesita recibir, no enviar.

---

## 🔗 Archivos Relacionados

| Archivo                        | ¿Qué relación tiene?                                                    | ¿Por qué es importante?                                                                          |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/services/chat-service.ts` | Es el servicio que este endpoint instancia y usa para procesar mensajes | Contiene toda la lógica de negocio: rate limiting, validación, sanitización, y la llamada a GROQ |
| `lib/rate-limiter.ts`          | Implementa el algoritmo de rate limiting que `ChatService` usa          | Define que máximo 20 mensajes por minuto por IP están permitidos                                 |
| `lib/ip-utils.ts`              | Proporciona las funciones de extracción de IP que se usan en el paso 1  | Sin estas funciones, no podríamos identificar al usuario para el rate limiting                   |
| `lib/schemas/chat.ts`          | Define el schema Zod que valida el body del request en el paso 4b       | Garantiza que `messages` sea un array válido y `model` sea un modelo permitido                   |
| `config/server.ts`             | Contiene `STREAM_CONFIG` y el `SYSTEM_PROMPT` que se inyecta a la IA    | Define la personalidad del asistente y los parámetros de streaming                               |
| `constants/messages.ts`        | Proporciona los mensajes de error estándar (`ERROR_MESSAGES`)           | Garantiza que los mismos errores siempre muestren el mismo mensaje al usuario                    |

---

**← Anterior**: [02 — Punto de Entrada](./02-punto-de-entrada.md) | **Siguiente**: [04 — Server Actions](./04-server-actions.md) →
