/**
 * Implementación de Rate Limiter
 *
 * Rate limiter simple en memoria usando algoritmo de ventana deslizante.
 * Limita las solicitudes por dirección IP para prevenir abusos.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RequestRecord {
  timestamps: number[];
}

export class RateLimiter {
  private requests: Map<string, RequestRecord>;
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.requests = new Map();
    this.config = config;

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Verifica si el identificador dado ha excedido el límite de tasa
   * @param identifier - Usualmente una dirección IP
   * @returns true si está dentro del límite, false si excedió
   */
  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier) || { timestamps: [] };

    // Remove timestamps outside the window
    record.timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Check if limit is exceeded
    if (record.timestamps.length >= this.config.maxRequests) {
      return false;
    }

    // Add current timestamp
    record.timestamps.push(now);
    this.requests.set(identifier, record);

    return true;
  }

  /**
   * Obtiene las solicitudes restantes para un identificador
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record) {
      return this.config.maxRequests;
    }

    const validTimestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    return Math.max(0, this.config.maxRequests - validTimestamps.length);
  }

  /**
   * Obtiene el tiempo hasta que se permita la siguiente solicitud (en ms)
   */
  getRetryAfter(identifier: string): number {
    const record = this.requests.get(identifier);

    if (!record || record.timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...record.timestamps);
    const resetTime = oldestTimestamp + this.config.windowMs;

    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Limpia entradas expiradas de la memoria
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [identifier, record] of this.requests.entries()) {
      record.timestamps = record.timestamps.filter(
        (timestamp) => now - timestamp < this.config.windowMs
      );

      // Remove entry if no valid timestamps
      if (record.timestamps.length === 0) {
        this.requests.delete(identifier);
      }
    }
  }

  /**
   * Destruye el limiter y limpia recursos
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// Global instance for chat API
export const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 requests per minute
});
