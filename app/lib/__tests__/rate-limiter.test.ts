import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  const testConfig = {
    windowMs: 1000, // 1 second window for faster tests
    maxRequests: 3,
  };

  beforeEach(() => {
    limiter = new RateLimiter(testConfig);
    vi.useFakeTimers();
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      expect(limiter.checkLimit('192.168.1.1')).toBe(true);
      expect(limiter.checkLimit('192.168.1.1')).toBe(true);
      expect(limiter.checkLimit('192.168.1.1')).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      // Fill up the limit
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');

      // Next request should be blocked
      expect(limiter.checkLimit('192.168.1.1')).toBe(false);
    });

    it('should track different IPs separately', () => {
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');

      // Different IP should have its own limit
      expect(limiter.checkLimit('192.168.1.2')).toBe(true);
    });

    it('should reset after time window', () => {
      // Fill up the limit
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');

      // Should be blocked
      expect(limiter.checkLimit('192.168.1.1')).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1001);

      // Should be allowed again
      expect(limiter.checkLimit('192.168.1.1')).toBe(true);
    });
  });

  describe('getRemaining', () => {
    it('should return max requests for new identifier', () => {
      expect(limiter.getRemaining('192.168.1.1')).toBe(3);
    });

    it('should decrease remaining count after requests', () => {
      limiter.checkLimit('192.168.1.1');
      expect(limiter.getRemaining('192.168.1.1')).toBe(2);

      limiter.checkLimit('192.168.1.1');
      expect(limiter.getRemaining('192.168.1.1')).toBe(1);

      limiter.checkLimit('192.168.1.1');
      expect(limiter.getRemaining('192.168.1.1')).toBe(0);
    });

    it('should never return negative remaining', () => {
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.1'); // This one exceeds

      expect(limiter.getRemaining('192.168.1.1')).toBe(0);
    });
  });

  describe('getRetryAfter', () => {
    it('should return 0 for new identifier', () => {
      expect(limiter.getRetryAfter('192.168.1.1')).toBe(0);
    });

    it('should return time until oldest request expires', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      limiter.checkLimit('192.168.1.1');

      // Advance 500ms
      vi.advanceTimersByTime(500);

      // Should have ~500ms left (oldest request was at startTime)
      const retryAfter = limiter.getRetryAfter('192.168.1.1');
      expect(retryAfter).toBeGreaterThanOrEqual(490);
      expect(retryAfter).toBeLessThanOrEqual(510);
    });

    it('should return 0 after window has passed', () => {
      limiter.checkLimit('192.168.1.1');

      // Advance past the window
      vi.advanceTimersByTime(1001);

      expect(limiter.getRetryAfter('192.168.1.1')).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      limiter.checkLimit('192.168.1.1');
      limiter.checkLimit('192.168.1.2');

      // Advance past window
      vi.advanceTimersByTime(1001);

      // Trigger cleanup (runs every 60 seconds)
      vi.advanceTimersByTime(60000);

      // After cleanup, should be like new
      expect(limiter.getRemaining('192.168.1.1')).toBe(3);
      expect(limiter.getRemaining('192.168.1.2')).toBe(3);
    });
  });

  describe('sliding window behavior', () => {
    it('should properly implement sliding window', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      // Make 3 requests at t=0
      limiter.checkLimit('192.168.1.1'); // t=0
      limiter.checkLimit('192.168.1.1'); // t=0
      limiter.checkLimit('192.168.1.1'); // t=0

      // Blocked at t=0
      expect(limiter.checkLimit('192.168.1.1')).toBe(false);

      // Advance 600ms (still within 1s window from first request)
      vi.advanceTimersByTime(600);

      // Still blocked (all 3 requests are still within the 1s window)
      expect(limiter.checkLimit('192.168.1.1')).toBe(false);

      // Advance another 500ms (total 1100ms, first request expired)
      vi.advanceTimersByTime(500);

      // Should be allowed now (only 2 requests in the window)
      expect(limiter.checkLimit('192.168.1.1')).toBe(true);
    });
  });
});
