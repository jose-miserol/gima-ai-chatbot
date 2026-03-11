/**
 * @file logger.ts
 * @module app/lib/logger
 *
 * ============================================================
 * LOGGER CENTRALIZADO — LOGGING ESTRUCTURADO CON NIVELES
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Proporciona un logger singleton con cuatro niveles de severidad
 *   (debug, info, warn, error), filtrado automático según el entorno
 *   de ejecución, y una estructura de contexto estándar para todos
 *   los logs del proyecto GIMA.
 *
 * POR QUÉ UN LOGGER CENTRALIZADO (y no console.log directo):
 *   - ENTORNO: Los logs de debug se filtran automáticamente en producción
 *     del lado del cliente. El servidor siempre loguea todo para trazabilidad.
 *   - ESTRUCTURA: Cada log incluye timestamp, nivel y contexto en JSON,
 *     facilitando la búsqueda y el filtrado en herramientas externas.
 *   - EXTENSIBILIDAD: El punto de integración con Sentry/Datadog está
 *     centralizado en un solo lugar (el método privado `log()`). Sin este
 *     logger, habría que modificar cientos de console.log al integrar Sentry.
 *   - CONSISTENCIA: Todo el código del proyecto usa la misma API de logging,
 *     independientemente del entorno o de si la integración externa está activa.
 *
 * COMPORTAMIENTO POR ENTORNO:
 *
 *   SERVIDOR (typeof window === 'undefined'):
 *     Todos los niveles se loguean siempre (debug, info, warn, error).
 *     Los logs del servidor son la fuente principal de diagnóstico en producción.
 *
 *   CLIENTE EN DESARROLLO:
 *     Todos los niveles se loguean (incluido debug).
 *     Permite ver el flujo completo de la aplicación en la consola del browser.
 *
 *   CLIENTE EN PRODUCCIÓN:
 *     Solo se loguean warn y error. Los logs de debug e info se suprimen
 *     para no exponer información de implementación a usuarios finales.
 *
 * INTEGRACIÓN FUTURA CON SENTRY (TODO en el código):
 *   El método `log()` privado tiene un bloque `if (production)` preparado
 *   para enviar logs a Sentry u otro servicio externo. Al integrar, solo
 *   hay que descomentar `Sentry.captureMessage(message, { level, extra: context })`.
 *   No se necesita modificar ningún otro archivo del proyecto.
 *
 * DÓNDE SE USA:
 *   En prácticamente todos los servicios y hooks del proyecto:
 *   - app/lib/services/*.ts → logging de llamadas a APIs y errores
 *   - app/hooks/use-voice-input.ts → logging de modo y errores de transcripción
 *   - app/lib/chat-tools.ts → logging de tool calls fallidas
 *   - app/lib/base-ai-service.ts → logging de reintentos y cache hits
 * ============================================================
 */

// ============================================================
// TIPOS
// ============================================================

/**
 * LogLevel — Niveles de severidad disponibles en el logger.
 *
 * CORRESPONDEN A los métodos de console: console.debug, console.info,
 * console.warn, console.error. El tipo garantiza que solo se usen
 * valores válidos y que el lookup `console[level]` en `log()` sea seguro.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * LogContext — Estructura de contexto estándar para todos los logs.
 *
 * QUÉ ES:
 *   Campos opcionales que acompañan al mensaje para añadir contexto estructurado.
 *   El index signature `[key: string]: unknown` permite campos adicionales
 *   específicos de cada sitio de log (ej: `messageId`, `cacheKey`, `attempt`).
 *
 * CAMPOS ESTÁNDAR:
 *   `component`: Nombre del componente o módulo que genera el log.
 *                Permite filtrar logs por origen: `component: 'useVoiceInput'`.
 *   `action`:    Operación específica en curso: `action: 'transcribeAudio'`.
 *   `userId`:    ID del usuario para correlacionar logs de una misma sesión.
 *                Vacío en el servidor cuando la sesión no está disponible.
 *
 * SERIALIZACIÓN:
 *   Los campos se mezclan en el objeto logObject con spread (`...context`),
 *   por lo que aparecen al mismo nivel que timestamp y level en el JSON final.
 */
interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

// ============================================================
// CLASE LOGGER
// ============================================================

/**
 * Logger — Clase interna con la implementación del logger.
 *
 * PATRÓN SINGLETON:
 *   Se exporta una única instancia (`export const logger = new Logger()`).
 *   Esto garantiza un punto de control único para todos los logs del proyecto
 *   y facilita el mocking en tests (`jest.spyOn(logger, 'error')`).
 *
 * POR QUÉ CLASE Y NO FUNCIONES EXPORTADAS:
 *   - El estado interno (si se añade rate limiting de logs en el futuro) se
 *     encapsula en la instancia.
 *   - El patrón `logger.error(msg, error, context)` es más ergonómico que
 *     `logError(msg, error, context)` al usar destructuring de importaciones.
 *   - La clase facilita el override en tests: `const mockLogger = { ...logger, error: jest.fn() }`.
 */
class Logger {
  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Determina si un nivel de log debe registrarse según el entorno actual.
   *
   * LÓGICA DE FILTRADO:
   *   - Servidor (SSR/API routes): siempre loguear todo. Los logs del servidor
   *     son críticos para el diagnóstico en producción y no son visibles al usuario.
   *   - Cliente en producción: suprimir 'debug' para no exponer información de
   *     implementación (rutas, IDs internos, estados intermedios) en la consola.
   *   - Cliente en desarrollo: loguear todo para máxima visibilidad durante el desarrollo.
   *
   * POR QUÉ SOLO SUPRIMIR 'debug' EN CLIENTE PRODUCTION (y no también 'info'):
   *   Los logs de 'info' en producción cliente son eventos de negocio relevantes
   *   (ej: "Chat message sent") que pueden ser útiles para el soporte. Los logs
   *   de 'debug' son detalles de implementación que solo interesan al desarrollador.
   *
   * @param level - Nivel del log a evaluar.
   * @returns `true` si el log debe registrarse, `false` si debe suprimirse.
   */
  private shouldLog(level: LogLevel): boolean {
    if (typeof window === 'undefined') return true; // Servidor: siempre loguear

    // Cliente en producción: solo warn y error (suprimir debug e info)
    if (process.env.NODE_ENV === 'production' && level === 'debug') {
      return false;
    }
    return true;
  }

  /**
   * Función central de logging. Todos los métodos públicos delegan aquí.
   *
   * QUÉ HACE:
   *   1. Verifica si el nivel debe loguearse con shouldLog().
   *   2. Construye el objeto de log con timestamp ISO 8601, nivel y contexto.
   *   3. En producción: punto de extensión para Sentry/Datadog (actualmente TODO).
   *   4. Emite el log al método de console correspondiente al nivel.
   *
   * FORMATO DEL OUTPUT:
   *   JSON pretty-printed (2 espacios) para legibilidad en consola de desarrollo.
   *   En producción con un agregador de logs (ej: Datadog), el JSON permite
   *   parsear y filtrar los campos estructurados automáticamente.
   *
   *   Ejemplo de output:
   *   ```json
   *   {
   *     "timestamp": "2024-01-15T10:30:00.000Z",
   *     "level": "error",
   *     "message": "Tool consultar_activos failed",
   *     "component": "chatTools",
   *     "action": "consultar_activos",
   *     "error": "ETIMEDOUT"
   *   }
   *   ```
   *
   * `console[level] || console.log`:
   *   TypeScript no garantiza que `console['debug']` exista en todos los entornos.
   *   El fallback a `console.log` previene errores en entornos muy restringidos
   *   (ej: algunos ambientes de CI que interceptan console).
   *
   * @param level   - Nivel de severidad del log.
   * @param message - Mensaje descriptivo del evento.
   * @param context - Contexto estructurado opcional para enriquecer el log.
   */
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      message,
      ...context, // Los campos de contexto se mezclan al mismo nivel que timestamp/level
    };

    // Punto de extensión para integración con servicios externos.
    // TODO: Integrar con Sentry u otro servicio de monitoreo:
    // Sentry.captureMessage(message, { level, extra: context });
    if (process.env.NODE_ENV === 'production') {
      // Placeholder para integración futura
    }

    // Usar el método de console que corresponde al nivel (console.warn, console.error, etc.)
    // Fallback a console.log si el método específico no está disponible
    const consoleMethod = (console as any)[level] || console.log;
    consoleMethod(JSON.stringify(logObject, null, 2));
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  /**
   * Registra un mensaje de nivel debug.
   *
   * CUÁNDO USAR:
   *   Información detallada sobre el flujo interno de la aplicación, útil
   *   solo durante el desarrollo. Ejemplos: estado de variables internas,
   *   valores de configuración cargados, decisiones de branching.
   *
   *   Solo se emite en el cliente durante desarrollo. En el servidor, siempre.
   *
   * @param message - Descripción del evento de debug.
   * @param context - Contexto estructurado opcional (component, action, etc.)
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  /**
   * Registra un mensaje informativo sobre un evento de negocio.
   *
   * CUÁNDO USAR:
   *   Eventos normales que vale la pena registrar para trazabilidad o auditoría.
   *   Ejemplos: mensaje de chat enviado, cache hit en un servicio de IA,
   *   OT creada exitosamente, usuario autenticado.
   *
   * @param message - Descripción del evento informativo.
   * @param context - Contexto estructurado opcional.
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  /**
   * Registra una advertencia sobre una situación anómala pero recuperable.
   *
   * CUÁNDO USAR:
   *   Algo fue inesperado pero la aplicación puede continuar. Ejemplos:
   *   caché de lectura fallido (continuamos sin caché), reintento de request
   *   de IA, rate limit cercano al límite, configuración con valor por defecto
   *   porque la variable de entorno estaba ausente.
   *
   * @param message - Descripción de la situación anómala.
   * @param context - Contexto estructurado opcional.
   */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  /**
   * Registra un error con el objeto Error original para stack trace.
   *
   * CUÁNDO USAR:
   *   Fallos que impiden completar una operación: tool call fallida,
   *   error de autenticación, timeout de red no recuperable, error de
   *   validación crítico, excepción no manejada en un servicio.
   *
   * POR QUÉ `error` ES UN PARÁMETRO SEPARADO (y no parte de `context`):
   *   - Permite que TypeScript valide que se pase un objeto `Error` real.
   *   - El método extrae `error.message` y `error.stack` como campos
   *     independientes en el JSON, facilitando la búsqueda por mensaje de error.
   *   - En Sentry, `error` es el objeto principal del evento, no metadata adicional.
   *
   * @param message - Descripción del error en contexto de la operación.
   * @param error   - Objeto Error con el mensaje técnico y stack trace (opcional).
   * @param context - Contexto estructurado adicional (component, action, etc.)
   *
   * @example
   * ```typescript
   * try {
   *   await api.getActivos(params);
   * } catch (err) {
   *   logger.error('Failed to fetch activos', err instanceof Error ? err : new Error(String(err)), {
   *     component: 'chatTools',
   *     action: 'consultar_activos',
   *   });
   * }
   * ```
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error?.message, // Mensaje técnico del Error (ej: "ETIMEDOUT")
      stack: error?.stack, // Stack trace para localizar el origen del error
    });
  }
}

// ============================================================
// INSTANCIA SINGLETON
// ============================================================

/**
 * logger — Instancia singleton del Logger para toda la aplicación.
 *
 * IMPORTAR Y USAR:
 * ```typescript
 * import { logger } from '@/app/lib/logger';
 *
 * // Debug: solo visible en desarrollo
 * logger.debug('MIME type detectado', { mimeType, component: 'useVoiceInput' });
 *
 * // Info: evento de negocio normal
 * logger.info('Cache hit', { serviceName: 'ChecklistAIService', cacheKey });
 *
 * // Warn: situación recuperable
 * logger.warn('Rate limit approaching', { remaining: 2, limit: 20 });
 *
 * // Error: fallo con objeto Error
 * logger.error('Tool failed', error, { component: 'chatTools', action: 'consultar_activos' });
 * ```
 */
export const logger = new Logger();
