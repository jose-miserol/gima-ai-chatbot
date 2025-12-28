import { streamText } from 'ai';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Importar después de los mocks
import type { Message } from '@/app/lib/schemas/chat';
import { ChatService, RateLimitError, ValidationError } from '@/app/lib/services/chat-service';

// Mock del módulo 'ai' ANTES de importar ChatService
vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

// Mock del módulo 'env' para evitar validación de API keys
vi.mock('@/app/config/env', () => ({
  env: {
    GROQ_API_KEY: 'gsk_test_mock_key_1234567890abcdef',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaTestMockKey1234567890',
    NODE_ENV: 'test',
  },
}));

// Mocks con implementaciones fake
const createMockLogger = () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

const createMockRateLimiter = () => ({
  checkLimit: vi.fn(() => true),
  getRetryAfter: vi.fn(() => 5000),
});

describe('ChatService', () => {
  let service: ChatService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockRateLimiter: ReturnType<typeof createMockRateLimiter>;
  let mockModelProvider: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Recrear mocks para aislamiento total
    mockLogger = createMockLogger();
    mockRateLimiter = createMockRateLimiter();
    mockModelProvider = vi.fn(() => ({
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
    }));

    service = new ChatService({
      logger: mockLogger as any,
      rateLimiter: mockRateLimiter as any,
      modelProvider: mockModelProvider as any,
    });

    // Mock streamText con respuesta válida
    (streamText as ReturnType<typeof vi.fn>).mockResolvedValue({
      toUIMessageStreamResponse: vi.fn(() => new Response('mock stream')),
    });
  });

  describe('Rate Limiting', () => {
    it('debe lanzar RateLimitError cuando límite es alcanzado', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(false);
      mockRateLimiter.getRetryAfter.mockReturnValue(5000);

      const validBody = createValidRequestBody();

      await expect(service.processMessage(validBody, '192.168.1.1')).rejects.toThrow(
        RateLimitError
      );

      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('192.168.1.1');
    });

    it('debe incluir retryAfter en error de rate limit', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(false);
      mockRateLimiter.getRetryAfter.mockReturnValue(5000);

      try {
        await service.processMessage(createValidRequestBody(), '192.168.1.1');
        expect.fail('Debería haber lanzado RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(5);
      }
    });
  });

  describe('Validación de Input', () => {
    it('debe lanzar ValidationError si messages no es array', async () => {
      const invalidBody = {
        messages: 'not an array', // Inválido
        model: 'llama-3.3-70b-versatile',
      };

      await expect(service.processMessage(invalidBody, '192.168.1.1')).rejects.toThrow(
        ValidationError
      );
    });

    it('debe lanzar ValidationError si mensaje sin role', async () => {
      const invalidBody = {
        messages: [
          { content: 'hello' }, // Falta 'role'
        ],
        model: 'llama-3.3-70b-versatile',
      };

      await expect(service.processMessage(invalidBody, '192.168.1.1')).rejects.toThrow(
        ValidationError
      );
    });

    it('debe aceptar modelo válido', async () => {
      const validBody = createValidRequestBody();

      await service.processMessage(validBody, '192.168.1.1');

      expect(mockModelProvider).toHaveBeenCalledWith('llama-3.3-70b-versatile');
    });
  });

  describe('Procesamiento de Mensajes', () => {
    it('debe llamar streamText con parámetros correctos', async () => {
      const validBody = createValidRequestBody();

      await service.processMessage(validBody, '192.168.1.1');

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'hello',
            }),
          ]),
        })
      );
    });

    it('debe incluir system prompt en llamada a AI', async () => {
      const validBody = createValidRequestBody();

      await service.processMessage(validBody, '192.168.1.1');

      const callArgs = (streamText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.system).toContain('GIMA');
      expect(callArgs.system).toContain('mantenimiento');
    });

    it('debe retornar el resultado de streamText', async () => {
      const mockStreamResult = {
        toUIMessageStreamResponse: vi.fn(() => new Response('mock stream')),
      };
      (streamText as ReturnType<typeof vi.fn>).mockReturnValue(mockStreamResult);

      const result = await service.processMessage(createValidRequestBody(), '192.168.1.1');

      expect(result).toBe(mockStreamResult);
    });
  });

  describe('Manejo de Errores', () => {
    it('debe manejar error de streamText', async () => {
      const streamError = new Error('GROQ API timeout');
      (streamText as ReturnType<typeof vi.fn>).mockRejectedValue(streamError);

      await expect(service.processMessage(createValidRequestBody(), '192.168.1.1')).rejects.toThrow(
        'GROQ API timeout'
      );
    });
  });
});

// ============================================
// Helper Functions
// ============================================

/**
 * Crea un cuerpo de request válido según chatRequestSchema
 */
function createValidRequestBody(): {
  messages: Message[];
  model: string;
} {
  return {
    messages: [
      {
        id: 'msg-123',
        role: 'user',
        content: 'hello',
        parts: [],
        // @ts-expect-error - Valid date string, preprocess handles conversion
        createdAt: new Date().toISOString(),
      },
    ],
    model: 'llama-3.3-70b-versatile',
  };
}
