/**
 * Tests for executeVoiceCommand in actions.ts
 *
 * Tests para la función que parsea comandos de voz:
 * - Validación de input vacío/corto
 * - Manejo de respuestas del modelo
 * - Validación Zod del resultado
 * - Manejo de errores y códigos
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock del módulo ai antes de importar
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Mock de la configuración del prompt
vi.mock('@/app/config/voice-command-prompt', () => ({
  WORK_ORDER_VOICE_PROMPT: 'Test prompt for voice commands',
}));

// Import después de los mocks
import { generateText } from 'ai';
import { executeVoiceCommand } from '../voice';

const mockGenerateText = vi.mocked(generateText);

describe('executeVoiceCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Validation', () => {
    it('should return EMPTY_TRANSCRIPT error for empty input', async () => {
      const result = await executeVoiceCommand('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_TRANSCRIPT');
        expect(result.recoverable).toBe(true);
      }
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should return EMPTY_TRANSCRIPT error for whitespace-only input', async () => {
      const result = await executeVoiceCommand('   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_TRANSCRIPT');
      }
    });

    it('should return EMPTY_TRANSCRIPT error for very short input', async () => {
      const result = await executeVoiceCommand('ab'); // Less than 3 chars

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_TRANSCRIPT');
      }
    });
  });

  describe('Successful Parsing', () => {
    it('should parse valid create_work_order command', async () => {
      const mockResponse = {
        action: 'create_work_order',
        equipment: 'UMA-001',
        location: 'Sector 3',
        priority: 'urgent',
        confidence: 0.95,
        rawTranscript: 'Crear orden urgente para la UMA del sector 3',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      const result = await executeVoiceCommand('Crear orden urgente para la UMA del sector 3');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.command.action).toBe('create_work_order');
        expect(result.command.equipment).toBe('UMA-001');
        expect(result.command.priority).toBe('urgent');
        expect(result.command.confidence).toBe(0.95);
      }
    });

    it('should parse list_pending command', async () => {
      const mockResponse = {
        action: 'list_pending',
        confidence: 1.0,
        rawTranscript: 'Mostrar órdenes pendientes',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      const result = await executeVoiceCommand('Mostrar órdenes pendientes');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.command.action).toBe('list_pending');
      }
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockResponse = {
        action: 'check_status',
        confidence: 0.9,
        rawTranscript: 'Estado de la orden',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: '```json\n' + JSON.stringify(mockResponse) + '\n```',
      } as any);

      const result = await executeVoiceCommand('Estado de la orden');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.command.action).toBe('check_status');
      }
    });
  });

  describe('Confidence Threshold', () => {
    it('should return LOW_CONFIDENCE error when below default threshold', async () => {
      const mockResponse = {
        action: 'create_work_order',
        confidence: 0.5, // Below default 0.7
        rawTranscript: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      const result = await executeVoiceCommand('Comando poco claro');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LOW_CONFIDENCE');
        expect(result.recoverable).toBe(true);
      }
    });

    it('should respect custom minConfidence option', async () => {
      const mockResponse = {
        action: 'create_work_order',
        confidence: 0.8,
        rawTranscript: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      // Should fail with 0.9 threshold
      const result = await executeVoiceCommand('Test command', { minConfidence: 0.9 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LOW_CONFIDENCE');
      }
    });

    it('should succeed when confidence meets threshold', async () => {
      const mockResponse = {
        action: 'create_work_order',
        confidence: 0.75,
        rawTranscript: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      const result = await executeVoiceCommand('Test command', { minConfidence: 0.7 });

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return PARSE_ERROR for invalid JSON response', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'This is not valid JSON',
      } as any);

      const result = await executeVoiceCommand('Test command');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('PARSE_ERROR');
        expect(result.recoverable).toBe(true);
      }
    });

    it('should return VALIDATION_ERROR for invalid schema', async () => {
      const invalidResponse = {
        action: 'invalid_action', // Not in enum
        confidence: 0.9,
        rawTranscript: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(invalidResponse),
      } as any);

      const result = await executeVoiceCommand('Test command');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.recoverable).toBe(true);
      }
    });

    it('should return EXECUTION_ERROR for API failures', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API Error'));

      const result = await executeVoiceCommand('Test command');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EXECUTION_ERROR');
        expect(result.recoverable).toBe(false);
      }
    });
  });

  describe('Context Option', () => {
    it('should include context in prompt when provided', async () => {
      const mockResponse = {
        action: 'create_work_order',
        confidence: 0.9,
        rawTranscript: 'Test',
      };

      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
      } as any);

      await executeVoiceCommand('Test command', {
        context: 'Mantenimiento preventivo activo',
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('CONTEXTO ADICIONAL'),
            }),
          ]),
        })
      );
    });
  });
});
