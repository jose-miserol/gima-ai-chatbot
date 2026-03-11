/**
 * @file ip-utils.ts
 * @module app/lib/ip-utils
 *
 * ============================================================
 * UTILIDADES DE IP — VALIDACIÓN Y EXTRACCIÓN DE DIRECCIONES IP
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Proporciona funciones para validar direcciones IP y extraer la IP del
 *   cliente desde los headers HTTP de un request entrante a la API de Next.js.
 *   Es la capa de identificación de cliente que alimenta al sistema de rate
 *   limiting del chat (RateLimiter en rate-limiter.ts).
 *
 * POR QUÉ ES NECESARIA LA EXTRACCIÓN DESDE HEADERS:
 *   En producción, GIMA se despliega detrás de un proxy inverso (Vercel Edge,
 *   nginx, Cloudflare). La IP real del cliente no está en la conexión TCP
 *   directa — el servidor solo ve la IP del proxy. Los proxies propagan la
 *   IP original en headers estándar:
 *
 *   `x-forwarded-for`:  Header estándar de facto (RFC 7239 como `Forwarded`).
 *                       Contiene una cadena de IPs: cliente, proxy1, proxy2, ...
 *                       La IP del cliente real siempre es la PRIMERA de la lista.
 *
 *   `x-real-ip`:        Header simplificado usado por nginx. Contiene solo la IP
 *                       del cliente (ya extraída por nginx de x-forwarded-for).
 *                       Más confiable que x-forwarded-for cuando nginx está configurado.
 *
 * PRIORIDAD DE HEADERS (en extractClientIP):
 *   1. x-forwarded-for (primero) → más universal, soportado por todos los CDNs.
 *   2. x-real-ip (fallback) → disponible cuando nginx hace el proxy.
 *   Si ninguno proporciona una IP válida → retornar null (el llamador decide).
 *
 * VALOR 'unknown' COMO CASO ESPECIAL:
 *   Algunos proxies envían 'unknown' en el header cuando no pueden determinar
 *   la IP del cliente (ej: proxies SOCKS, conexiones desde Tor). `isValidIP`
 *   trata explícitamente 'unknown' como inválido para no pasar ese string
 *   al sistema de rate limiting.
 *
 * DÓNDE SE USA:
 *   - app/api/chat/route.ts → para extraer la IP antes de checkLimit()
 * ============================================================
 */

import { NextResponse } from 'next/server';

// ============================================================
// EXPRESIONES REGULARES DE VALIDACIÓN
// ============================================================

/**
 * Regex para validar direcciones IPv4 estrictas.
 *
 * FORMATO: `xxx.xxx.xxx.xxx` donde cada octeto es un número entero de 0 a 255.
 *
 * DESGLOSE DEL PATRÓN:
 *   `(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)` — Un octeto válido:
 *   - `25[0-5]`        → 250-255
 *   - `2[0-4][0-9]`    → 200-249
 *   - `[01]?[0-9][0-9]?` → 0-199 (con o sin cero inicial)
 *   Los cuatro octetos se separan por puntos literales `\.`.
 *   Los anchors `^` y `$` garantizan que no haya texto adicional alrededor.
 *
 * EJEMPLOS VÁLIDOS: '192.168.1.1', '10.0.0.1', '0.0.0.0', '255.255.255.255'
 * EJEMPLOS INVÁLIDOS: '256.0.0.1', '192.168.1', '192.168.1.1.1', '192.168.01.1'
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Regex para validar direcciones IPv6 (cobertura de casos comunes, no exhaustiva).
 *
 * FORMATOS SOPORTADOS:
 *   - Completo:          `2001:0db8:85a3:0000:0000:8a2e:0370:7334`
 *   - Con `::` inicial:  `::1` (loopback), `::ffff:192.168.1.1` (IPv4-mapped)
 *   - Con `::` al final: `fe80::` (link-local sin sufijo)
 *   - Con `::` al medio: `2001:db8::1` (forma abreviada más común)
 *
 * LIMITACIÓN:
 *   Este regex cubre los formatos más frecuentes pero no es un validador IPv6
 *   completamente exhaustivo según RFC 4291. Para validación completa se
 *   necesitaría una librería como `is-ip`. Para el propósito de rate limiting
 *   de GIMA, esta cobertura es suficiente.
 *
 * EJEMPLOS VÁLIDOS: '::1', '2001:db8::1', 'fe80::1', '::ffff:192.168.1.1'
 */
const IPV6_REGEX =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

// ============================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================

/**
 * Valida si un string representa una dirección IP válida (IPv4 o IPv6).
 *
 * QUÉ HACE:
 *   Comprueba el string contra IPV4_REGEX e IPV6_REGEX. Retorna false
 *   inmediatamente para strings vacíos o el valor especial 'unknown'.
 *
 * POR QUÉ RECHAZAR 'unknown' EXPLÍCITAMENTE:
 *   Algunos proxies (incluidos ciertos balanceadores de carga cloud) insertan
 *   el literal 'unknown' en el header x-forwarded-for cuando no pueden
 *   determinar la IP del cliente. Sin este check, 'unknown' fallaría la regex
 *   (correcto) pero el código que llama a isValidIP ya habría procesado el string.
 *   El check explícito hace la intención clara para el lector del código.
 *
 * @param ip - String a validar. Acepta cualquier string (no lanza si el formato es inesperado).
 * @returns `true` si el string es una IPv4 o IPv6 válida, `false` en cualquier otro caso.
 *
 * @example
 * ```typescript
 * isValidIP('192.168.1.1')  // true  → IPv4 válida
 * isValidIP('::1')          // true  → IPv6 loopback válida
 * isValidIP('unknown')      // false → valor de proxy sin IP
 * isValidIP('')             // false → string vacío
 * isValidIP('10.0.0.999')  // false → octeto fuera de rango
 * ```
 */
export function isValidIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

// ============================================================
// EXTRACCIÓN DE IP DEL REQUEST
// ============================================================

/**
 * Opciones de configuración para extractClientIP().
 */
export interface ExtractIPOptions {
  /**
   * Si es `true`, retorna la string 'localhost' cuando ningún header
   * proporciona una IP válida.
   *
   * CUÁNDO USAR:
   *   Solo en entorno de desarrollo local (process.env.NODE_ENV === 'development').
   *   En producción dejar en `false` (default) para que el sistema de rate
   *   limiting no acepte requests sin IP identificable.
   *
   * POR QUÉ 'localhost' Y NO null:
   *   Retornar 'localhost' permite que el rate limiter funcione en desarrollo
   *   local usando 'localhost' como identificador, sin necesidad de simular
   *   headers de proxy o deshabilitar el rate limiting completamente.
   */
  allowLocalhost?: boolean;
}

/**
 * Extrae la dirección IP del cliente desde los headers HTTP del request.
 *
 * QUÉ HACE:
 *   Busca la IP del cliente real en los headers estándar de proxy, en orden
 *   de prioridad. Valida cada candidata antes de retornarla para evitar pasar
 *   valores inválidos o maliciosos al sistema de rate limiting.
 *
 * ORDEN DE BÚSQUEDA:
 *   1. `x-forwarded-for` → el primer elemento de la lista separada por comas.
 *      Ejemplo: "203.0.113.1, 10.0.0.1, 172.16.0.1" → retorna "203.0.113.1".
 *   2. `x-real-ip` → header simplificado de nginx, contiene solo la IP del cliente.
 *   3. 'localhost' (si `allowLocalhost: true`) → para desarrollo sin proxy.
 *   4. `null` → IP no determinable; el llamador debe rechazar el request.
 *
 * SEGURIDAD — CONFIANZA EN LOS HEADERS:
 *   Los headers x-forwarded-for pueden ser falsificados por el cliente si
 *   no hay un proxy confiable delante del servidor. En Vercel, los headers
 *   son inyectados por la infraestructura y no pueden ser modificados por el
 *   cliente. En despliegues propios detrás de nginx, configurar:
 *   `set_real_ip_from <rango_del_proxy>` y `real_ip_header X-Forwarded-For`
 *   para que nginx sobrescriba el header con la IP real.
 *
 * @param req     - Request HTTP de Next.js (Web API Request).
 * @param options - Opciones de extracción (allowLocalhost para desarrollo).
 * @returns IP del cliente como string, o `null` si no se pudo determinar.
 *
 * @example
 * ```typescript
 * // En producción (app/api/chat/route.ts):
 * const ip = extractClientIP(req);
 * if (!ip) return createInvalidIPResponse(); // Rechazar sin IP
 * const allowed = chatRateLimiter.checkLimit(ip);
 *
 * // En desarrollo (con proxy local simulado):
 * const ip = extractClientIP(req, { allowLocalhost: true });
 * // ip === 'localhost' si no hay headers de proxy
 * ```
 */
export function extractClientIP(req: Request, options?: ExtractIPOptions): string | null {
  // Prioridad 1: x-forwarded-for (universal, soportado por Vercel, AWS, Cloudflare)
  const forwardedFor = req.headers.get('x-forwarded-for');

  if (forwardedFor) {
    // x-forwarded-for puede contener múltiples IPs: "cliente, proxy1, proxy2"
    // La IP del cliente real es siempre la PRIMERA de la lista (más a la izquierda)
    const firstIP = forwardedFor.split(',')[0].trim();
    if (isValidIP(firstIP)) return firstIP;
  }

  // Prioridad 2: x-real-ip (nginx simplifica x-forwarded-for a un solo valor)
  const realIP = req.headers.get('x-real-ip');
  if (realIP && isValidIP(realIP)) return realIP;

  // Prioridad 3: 'localhost' para desarrollo local sin proxy
  if (options?.allowLocalhost) return 'localhost';

  // Sin IP identificable → el llamador debe decidir (normalmente rechazar el request)
  return null;
}

// ============================================================
// RESPUESTAS DE ERROR
// ============================================================

/**
 * Crea una respuesta HTTP 400 estándar para requests sin IP de cliente válida.
 *
 * QUÉ HACE:
 *   Genera un NextResponse JSON con status 400 y un mensaje de error estructurado.
 *   Se usa en route.ts cuando extractClientIP() retorna null, para rechazar el
 *   request antes de llegar al procesamiento del chat.
 *
 * POR QUÉ 400 (Bad Request) Y NO 403 (Forbidden):
 *   HTTP 403 implica que el servidor entendió el request pero lo rechaza por
 *   permisos. HTTP 400 indica que el request en sí es inválido o malformado.
 *   Un request sin IP identificable es técnicamente un request que no puede
 *   ser procesado por razones de infraestructura, no de autorización.
 *
 * CAMPO `message` EN INGLÉS:
 *   El error HTTP de la API sigue la convención de inglés para mensajes de
 *   nivel de infraestructura. Los errores de negocio (chat, OTs, etc.)
 *   usan español para los mensajes al usuario final.
 *
 * @returns NextResponse con body JSON `{ error, message }` y status 400.
 */
export function createInvalidIPResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid or missing client IP',
      message: 'Unable to identify client. Please try again or contact support.',
    },
    { status: 400 }
  );
}
