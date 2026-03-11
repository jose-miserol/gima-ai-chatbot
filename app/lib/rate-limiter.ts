/**
 * @file rate-limiter.ts
 * @module app/lib/rate-limiter
 *
 * ============================================================
 * RATE LIMITER — CONTROL DE TASA DE REQUESTS POR IP (EN MEMORIA)
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Implementa un rate limiter en memoria usando el algoritmo de ventana
 *   deslizante (sliding window) para limitar la cantidad de requests que
 *   un mismo cliente puede hacer a la API de chat en un período de tiempo.
 *   Expone además la instancia global `chatRateLimiter` pre-configurada
 *   para el endpoint /api/chat.
 *
 * ALGORITMO: VENTANA DESLIZANTE (Sliding Window)
 *   A diferencia de la ventana fija (Fixed Window), que resetea el contador
 *   en intervalos fijos (ej: cada minuto en punto), la ventana deslizante
 *   evalúa los últimos N milisegundos desde el momento actual.
 *
 *   VENTAJA sobre ventana fija:
 *   Con ventana fija, un cliente puede hacer 20 requests al segundo 0:59
 *   y otros 20 al segundo 1:00 — 40 requests en 2 segundos sin violar el límite.
 *   Con ventana deslizante, si hizo 20 requests en el último minuto, debe
 *   esperar hasta que el más antiguo salga de la ventana antes de hacer otro.
 *
 *   IMPLEMENTACIÓN:
 *   Cada cliente tiene un array de timestamps Unix (ms). En cada checkLimit():
 *   1. Se filtran los timestamps que están fuera de la ventana (ahora - windowMs).
 *   2. Si quedan `maxRequests` o más timestamps válidos → rechazar (false).
 *   3. Si hay espacio → añadir el timestamp actual y permitir (true).
 *
 * ALMACENAMIENTO: EN MEMORIA (Map<string, RequestRecord>)
 *   VENTAJA: Cero dependencias externas, latencia O(1), funciona en desarrollo.
 *   LIMITACIÓN: El estado no se comparte entre instancias del servidor.
 *   En despliegues multi-instancia (Vercel con múltiples Edge Functions),
 *   un cliente puede superar el límite real haciendo requests a distintas
 *   instancias. Para rate limiting distribuido se necesitaría Redis (Upstash).
 *
 * GESTIÓN DE MEMORIA:
 *   El setInterval de cleanup() previene memory leaks en ejecuciones largas.
 *   Sin cleanup, la Map crecería indefinidamente con IPs que ya no hacen requests.
 *
 * DÓNDE SE USA:
 *   - app/api/chat/route.ts → `chatRateLimiter.checkLimit(ip)` al inicio del handler
 *   - ip-utils.ts → proporciona la IP que se usa como `identifier`
 * ============================================================
 */

// ============================================================
// TIPOS DE CONFIGURACIÓN
// ============================================================

/**
 * RateLimitConfig — Parámetros de configuración del rate limiter.
 *
 * CAMPOS:
 *   `windowMs`:    Duración de la ventana deslizante en milisegundos.
 *                  Ejemplo: 60 * 1000 = ventana de 1 minuto.
 *   `maxRequests`: Número máximo de requests permitidos dentro de la ventana.
 *                  Al alcanzar este número, checkLimit() retorna false hasta
 *                  que algún timestamp salga de la ventana.
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/**
 * RequestRecord — Registro de timestamps de requests para un cliente.
 *
 * QUÉ ES:
 *   Estructura interna almacenada en la Map por IP. Contiene el historial
 *   de timestamps Unix (ms) de todos los requests recientes del cliente.
 *   Solo se mantienen los timestamps dentro de la ventana activa; los
 *   anteriores se eliminan en cada checkLimit() y en el cleanup periódico.
 *
 * POR QUÉ UN ARRAY DE TIMESTAMPS (y no solo un contador):
 *   Un contador simple no permite implementar ventana deslizante.
 *   Para saber cuándo expira el request más antiguo (getRetryAfter()),
 *   se necesita el timestamp exacto de cada request, no solo la cantidad.
 */
interface RequestRecord {
  timestamps: number[];
}

// ============================================================
// CLASE RATE LIMITER
// ============================================================

/**
 * RateLimiter — Implementación de rate limiting con ventana deslizante.
 *
 * CICLO DE VIDA:
 *   1. Instanciar con `new RateLimiter(config)` o usar la instancia global `chatRateLimiter`.
 *   2. En cada request: `checkLimit(ip)` → true (permitir) o false (rechazar).
 *   3. Para headers de respuesta: `getRemaining(ip)` y `getRetryAfter(ip)`.
 *   4. Al destruir el servidor o en tests: `destroy()` para limpiar el interval.
 *
 * THREAD SAFETY:
 *   Node.js es single-threaded, por lo que no hay condiciones de carrera
 *   en las operaciones sobre la Map. Las operaciones son atómicas en el
 *   event loop de Node.
 */
export class RateLimiter {
  /** Map de IP → historial de timestamps. La estructura central del rate limiter. */
  private requests: Map<string, RequestRecord>;

  /** Configuración de ventana y límite de requests. */
  private config: RateLimitConfig;

  /**
   * Intervalo periódico de limpieza de entradas expiradas.
   * Se guarda la referencia para poder cancelarlo con `destroy()`.
   */
  private cleanupInterval: NodeJS.Timeout;

  /**
   * Crea una nueva instancia del rate limiter con la configuración dada.
   *
   * QUÉ HACE:
   *   1. Inicializa la Map vacía de requests.
   *   2. Guarda la configuración de ventana y límite.
   *   3. Registra un setInterval de 60 segundos para limpiar entradas expiradas.
   *
   * POR QUÉ cleanup() CADA 60 SEGUNDOS:
   *   El intervalo de 60s es independiente de `windowMs`. Si windowMs fuera
   *   de 5 minutos, los entries expirados podrían vivir hasta 60s adicionales
   *   en la Map sin causar problemas funcionales (ya son ignorados por el filtro
   *   en checkLimit). El tradeoff: intervalo más corto → menor memoria ocupada,
   *   mayor CPU. 60s es un buen balance para el volumen esperado de GIMA.
   *
   * @param config - Configuración del rate limiter (ventana y límite de requests).
   */
  constructor(config: RateLimitConfig) {
    this.requests = new Map();
    this.config = config;

    // Cleanup periódico para evitar que la Map crezca indefinidamente
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  /**
   * Verifica si el cliente identificado puede hacer un nuevo request.
   *
   * QUÉ HACE (algoritmo de ventana deslizante):
   *   1. Obtiene (o crea) el RequestRecord del identificador en la Map.
   *   2. Filtra los timestamps que quedaron fuera de la ventana actual
   *      (ahora - windowMs). Esta es la "deslizante" del algoritmo.
   *   3. Si el número de timestamps válidos restantes >= maxRequests → rechaza.
   *   4. Si hay espacio → añade el timestamp actual al array y permite.
   *
   * MUTACIÓN DEL RECORD:
   *   checkLimit() modifica el array de timestamps del record en cada llamada.
   *   El filtrado del paso 2 elimina entradas antiguas, manteniendo la Map
   *   compacta sin esperar al cleanup() periódico.
   *
   * @param identifier - Identificador del cliente, típicamente su dirección IP.
   * @returns `true` si el request está dentro del límite permitido, `false` si lo excedió.
   *
   * @example
   * ```typescript
   * const allowed = chatRateLimiter.checkLimit(clientIP);
   * if (!allowed) {
   *   const retryAfter = chatRateLimiter.getRetryAfter(clientIP);
   *   return NextResponse.json({ error: 'Rate limit exceeded' }, {
   *     status: 429,
   *     headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) }
   *   });
   * }
   * ```
   */
  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier) || { timestamps: [] };

    // Ventana deslizante: descartar timestamps fuera de la ventana actual
    record.timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Límite alcanzado: rechazar el request sin añadir el timestamp
    if (record.timestamps.length >= this.config.maxRequests) {
      return false;
    }

    // Dentro del límite: registrar el request y permitir
    record.timestamps.push(now);
    this.requests.set(identifier, record);

    return true;
  }

  /**
   * Obtiene el número de requests restantes para el cliente en la ventana actual.
   *
   * CUÁNDO USAR:
   *   Para incluir el header `X-RateLimit-Remaining` en las respuestas de la API,
   *   permitiendo que el cliente adapte su frecuencia de requests antes de ser rechazado.
   *
   * NOTA — NO MODIFICA EL RECORD:
   *   A diferencia de checkLimit(), este método solo lee el estado actual sin
   *   añadir timestamps. Es seguro llamarlo múltiples veces sin efectos secundarios.
   *
   * @param identifier - Identificador del cliente (IP).
   * @returns Número de requests disponibles en la ventana actual. Mínimo 0.
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const record = this.requests.get(identifier);

    // Si el cliente no tiene historial, tiene todos los requests disponibles
    if (!record) {
      return this.config.maxRequests;
    }

    // Contar solo los timestamps dentro de la ventana activa
    const validTimestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    return Math.max(0, this.config.maxRequests - validTimestamps.length);
  }

  /**
   * Calcula el tiempo de espera hasta que el cliente pueda hacer el siguiente request.
   *
   * CUÁNDO USAR:
   *   Cuando checkLimit() retorna false, usar este método para incluir el header
   *   `Retry-After` en la respuesta HTTP 429, indicando al cliente cuándo reintentar.
   *
   * CÁLCULO:
   *   El cliente podrá hacer otro request cuando el timestamp MÁS ANTIGUO de la ventana
   *   expire. El tiempo de espera es: `timestampMásAntiguo + windowMs - ahora`.
   *   `Math.min(...record.timestamps)` encuentra el más antiguo.
   *
   *   Por qué el más antiguo (y no el más reciente):
   *   La ventana deslizante libera espacio de uno en uno conforme expiran los timestamps.
   *   El primero en expirar es el más antiguo, liberando un slot para el nuevo request.
   *
   * @param identifier - Identificador del cliente (IP).
   * @returns Milisegundos hasta el próximo request permitido. 0 si puede hacer requests ya.
   *
   * @example
   * ```typescript
   * const retryAfterMs = chatRateLimiter.getRetryAfter(clientIP);
   * const retryAfterSecs = Math.ceil(retryAfterMs / 1000); // Convertir a segundos para Retry-After header
   * ```
   */
  getRetryAfter(identifier: string): number {
    const record = this.requests.get(identifier);

    // Sin historial → puede hacer requests inmediatamente
    if (!record || record.timestamps.length === 0) {
      return 0;
    }

    // El timestamp más antiguo determina cuándo se libera el primer slot
    const oldestTimestamp = Math.min(...record.timestamps);
    const resetTime = oldestTimestamp + this.config.windowMs;

    return Math.max(0, resetTime - Date.now());
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Elimina entradas expiradas de la Map para liberar memoria.
   *
   * QUÉ HACE:
   *   Itera sobre todos los entries de la Map y:
   *   1. Filtra los timestamps fuera de la ventana (igual que en checkLimit).
   *   2. Si el record queda con 0 timestamps válidos → elimina el entry completo.
   *      Un record vacío indica que el cliente no ha hecho requests en la ventana
   *      activa y no necesita ocupar espacio en memoria.
   *
   * POR QUÉ NO DEPENDER SOLO DEL FILTRO EN checkLimit():
   *   checkLimit() solo filtra el record del cliente que hace el request.
   *   Los clientes inactivos (que dejaron de hacer requests) nunca tendrían
   *   sus records limpiados sin este método, causando un memory leak gradual
   *   en aplicaciones con muchos clientes únicos (ej: tráfico de scraping).
   *
   * SE LLAMA AUTOMÁTICAMENTE cada 60 segundos via setInterval en el constructor.
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [identifier, record] of this.requests.entries()) {
      // Filtrar timestamps expirados del record
      record.timestamps = record.timestamps.filter(
        (timestamp) => now - timestamp < this.config.windowMs
      );

      // Si el record quedó vacío, eliminar el entry completo de la Map
      if (record.timestamps.length === 0) {
        this.requests.delete(identifier);
      }
    }
  }

  // ============================================================
  // CICLO DE VIDA
  // ============================================================

  /**
   * Destruye el rate limiter, cancela el interval y libera memoria.
   *
   * CUÁNDO USAR:
   *   - En tests de integración: llamar `destroy()` en el `afterEach` para evitar
   *     que el setInterval bloquee el proceso de Jest después de cada test.
   *   - En Hot Module Replacement (desarrollo): Next.js puede re-instanciar el módulo
   *     y crear múltiples instancias con sus respectivos intervals. `destroy()` en el
   *     handler de HMR previene la acumulación de intervals en desarrollo.
   *
   * POR QUÉ ES IMPORTANTE `clearInterval`:
   *   Los `setInterval` mantienen el proceso Node.js vivo. Sin limpiarlos, los tests
   *   con Jest pueden "colgar" esperando que los intervals terminen, o jest --forceExit
   *   es necesario. En producción Vercel (serverless), los intervals se limpian al
   *   terminar la invocación, pero en instancias persistentes (ej: Vercel with warm
   *   functions) pueden acumularse.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// ============================================================
// INSTANCIA GLOBAL
// ============================================================

/**
 * chatRateLimiter — Instancia singleton pre-configurada para el endpoint /api/chat.
 *
 * CONFIGURACIÓN:
 *   - windowMs: 60,000ms (1 minuto): Ventana de evaluación.
 *   - maxRequests: 20: Máximo de requests por minuto por IP.
 *
 * POR QUÉ 20 REQUESTS/MINUTO:
 *   Diseñado para usuarios humanos interactuando con el chat de GIMA.
 *   Un usuario normal envía entre 5-10 mensajes por minuto en una conversación activa.
 *   El límite de 20 da margen holgado para usuarios que adjuntan archivos (que pueden
 *   necesitar varios reintentos) sin permitir uso automatizado abusivo.
 *
 * INSTANCIA A NIVEL DE MÓDULO (no dentro del handler):
 *   La instancia se crea una vez cuando el módulo es importado por primera vez
 *   por Next.js. Esto garantiza que el estado de la Map persista entre requests
 *   en la misma instancia del servidor. Si se creara dentro del handler de la
 *   ruta, el estado se resetearía en cada request.
 *
 * USO EN route.ts:
 * ```typescript
 * import { chatRateLimiter } from '@/app/lib/rate-limiter';
 * import { extractClientIP, createInvalidIPResponse } from '@/app/lib/ip-utils';
 *
 * export async function POST(req: Request) {
 *   const ip = extractClientIP(req);
 *   if (!ip) return createInvalidIPResponse();
 *
 *   if (!chatRateLimiter.checkLimit(ip)) {
 *     const retryAfter = chatRateLimiter.getRetryAfter(ip);
 *     return NextResponse.json(
 *       { error: 'Too many requests' },
 *       { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } }
 *     );
 *   }
 *   // ... procesar el chat
 * }
 * ```
 */
export const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 20, // 20 requests por minuto por IP
});
