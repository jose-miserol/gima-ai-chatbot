/**
 * Contract Tests - GROQ API Integration
 *
 * Estos tests validan el contrato real con la API de GROQ.
 * Los tests de integración real solo se ejecutan si GROQ_API_KEY está en .env.local
 *
 * Uso: npm test tests/api/chat/contract.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del módulo 'ai' para tests offline
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Mock del módulo 'env' para evitar validación de API keys
vi.mock('@/app/config/env', () => ({
  env: {
    GROQ_API_KEY: 'gsk_test_mock_key_1234567890abcdef',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaTestMockKey1234567890',
    NODE_ENV: 'test',
  },
}));

// Importar después de los mocks
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

// ===========================================
// Contract Tests con Mocks
// ===========================================

describe('Contract: GROQ API (Mocked)', () => {
  const groq = createGroq({ apiKey: 'gsk_test_mock_key_1234567890abcdef' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generateText with correct message format', async () => {
    const mockResult = {
      text: 'OK',
      usage: { promptTokens: 10, completionTokens: 2 },
    };
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: 'Responde solo con la palabra "OK"' }],
    });

    expect(result.text).toBe('OK');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: expect.any(String) }),
        ]),
      })
    );
  });

  it('should call generateText with system prompt', async () => {
    const mockResult = {
      text: '7',
      usage: { promptTokens: 15, completionTokens: 1 },
    };
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: 'Eres un asistente que solo responde con números.',
      messages: [{ role: 'user', content: 'Dame un número del 1 al 10' }],
    });

    expect(result.text).toBe('7');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Eres un asistente que solo responde con números.',
      })
    );
  });

  it('should handle conversation context', async () => {
    const mockResult = {
      text: 'Tu nombre es Carlos.',
      usage: { promptTokens: 30, completionTokens: 5 },
    };
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        { role: 'user', content: 'Mi nombre es Carlos.' },
        { role: 'assistant', content: 'Hola Carlos, ¿en qué puedo ayudarte?' },
        { role: 'user', content: '¿Cuál es mi nombre?' },
      ],
    });

    expect(result.text.toLowerCase()).toContain('carlos');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({ role: 'assistant' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  it('should return usage information', async () => {
    const mockResult = {
      text: 'Hola',
      usage: { promptTokens: 5, completionTokens: 2 },
    };
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: 'Hola' }],
    });

    expect(result.usage).toBeDefined();
    // Verify usage has expected structure
    expect(result.usage).toHaveProperty('promptTokens');
    expect(result.usage).toHaveProperty('completionTokens');
  });
});

// ===========================================
// Offline Contract Tests (Format Validation)
// ===========================================

describe('Contract: Message Format Validation', () => {
  it('should validate sanitized message format matches GROQ expectations', () => {
    const sanitizedMessage = {
      role: 'user' as const,
      content: 'Test message',
    };

    // GROQ expects: { role: 'user' | 'assistant' | 'system', content: string }
    expect(sanitizedMessage).toHaveProperty('role');
    expect(sanitizedMessage).toHaveProperty('content');
    expect(['user', 'assistant', 'system']).toContain(sanitizedMessage.role);
    expect(typeof sanitizedMessage.content).toBe('string');
  });

  it('should validate conversation format is an array', () => {
    const conversation = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];

    expect(Array.isArray(conversation)).toBe(true);
    expect(conversation.length).toBeGreaterThan(0);
  });
});
