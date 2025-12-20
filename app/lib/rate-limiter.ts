/**
 * Rate Limiter Implementation
 *
 * Simple in-memory rate limiter using sliding window algorithm.
 * Limits requests per IP address to prevent abuse.
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
   * Check if the given identifier has exceeded the rate limit
   * @param identifier - Usually an IP address
   * @returns true if within limit, false if exceeded
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
   * Get remaining requests for an identifier
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
   * Get time until next request is allowed (in ms)
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
   * Cleanup expired entries from memory
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
   * Destroy the limiter and cleanup resources
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
