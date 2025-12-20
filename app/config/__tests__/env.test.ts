import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests para validación de variables de entorno
 */

describe('Environment Validation', () => {
  const envSchema = z.object({
    GROQ_API_KEY: z
      .string()
      .min(1, 'GROQ_API_KEY es requerida')
      .startsWith('gsk_', 'GROQ API key debe empezar con "gsk_"'),
    GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .min(1, 'Google API Key es requerida')
      .startsWith('AIza', 'Google API key debe empezar con "AIza"'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  });

  describe('GROQ_API_KEY validation', () => {
    it('should accept valid GROQ API key', () => {
      const validEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should reject GROQ API key without gsk_ prefix', () => {
      const invalidEnv = {
        GROQ_API_KEY: 'invalid_key_12345',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('gsk_');
      }
    });

    it('should reject empty GROQ API key', () => {
      const invalidEnv = {
        GROQ_API_KEY: '',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('GROQ_API_KEY');
      }
    });
  });

  describe('GOOGLE_GENERATIVE_AI_API_KEY validation', () => {
    it('should accept valid Google API key', () => {
      const validEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should reject Google API key without AIza prefix', () => {
      const invalidEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: 'invalid_google_key',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('AIza');
      }
    });

    it('should reject empty Google API key', () => {
      const invalidEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: '',
        NODE_ENV: 'development' as const,
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Google API Key');
      }
    });
  });

  describe('NODE_ENV validation', () => {
    it('should accept valid NODE_ENV values', () => {
      const validEnvs = ['development', 'production', 'test'];

      validEnvs.forEach((env) => {
        const config = {
          GROQ_API_KEY: 'gsk_1234567890abcdef',
          GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
          NODE_ENV: env,
        };

        const result = envSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid NODE_ENV', () => {
      const invalidEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
        NODE_ENV: 'staging',
      };

      const result = envSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
    });

    it('should default to development if NODE_ENV is missing', () => {
      const envWithoutNodeEnv = {
        GROQ_API_KEY: 'gsk_1234567890abcdef',
        GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz',
      };

      const result = envSchema.parse(envWithoutNodeEnv);
      expect(result.NODE_ENV).toBe('development');
    });
  });
});
