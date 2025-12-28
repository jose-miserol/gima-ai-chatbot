/**
 * Tests for useVoiceInput Hook
 *
 * Tests de funcionalidad del hook de voice input:
 * - Inicialización y soporte de navegador
 * - Manejo de estados (listening, processing)
 * - Callbacks (onTranscript, onError)
 * - Modos (gemini, native)
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the entire module to avoid browser API issues
vi.mock('@/app/actions', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    success: true,
    text: 'Texto transcrito',
  }),
}));

// Mock logger
vi.mock('@/app/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useVoiceInput Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hook Import and Basic Structure', () => {
    it('should be importable', async () => {
      const voiceModule = await import('@/app/hooks/use-voice-input');
      expect(voiceModule.useVoiceInput).toBeDefined();
      expect(typeof voiceModule.useVoiceInput).toBe('function');
    });
  });

  describe('Hook Return Type', () => {
    it('should return expected properties', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const { result } = renderHook(() => useVoiceInput({}));

      // Check all expected properties exist
      expect(result.current).toHaveProperty('isListening');
      expect(result.current).toHaveProperty('isProcessing');
      expect(result.current).toHaveProperty('isSupported');
      expect(result.current).toHaveProperty('mode');
      expect(result.current).toHaveProperty('toggleListening');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('transcript');
    });

    it('should have correct initial values', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const { result } = renderHook(() => useVoiceInput({}));

      expect(result.current.isListening).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.transcript).toBe('');
      expect(typeof result.current.toggleListening).toBe('function');
    });
  });

  describe('Mode Detection', () => {
    it('should have a mode property that is gemini or native', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const { result } = renderHook(() => useVoiceInput({}));

      expect(['gemini', 'native']).toContain(result.current.mode);
    });
  });

  describe('Callback Options', () => {
    it('should accept onTranscript callback without error', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const onTranscript = vi.fn();

      expect(() => {
        renderHook(() => useVoiceInput({ onTranscript }));
      }).not.toThrow();
    });

    it('should accept onError callback without error', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const onError = vi.fn();

      expect(() => {
        renderHook(() => useVoiceInput({ onError }));
      }).not.toThrow();
    });

    it('should accept onStateChange callback without error', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const onStateChange = vi.fn();

      expect(() => {
        renderHook(() => useVoiceInput({ onStateChange }));
      }).not.toThrow();
    });

    it('should accept language option', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');

      expect(() => {
        renderHook(() => useVoiceInput({ language: 'es-ES' }));
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should not throw on unmount', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const { unmount } = renderHook(() => useVoiceInput({}));

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Multiple Instances', () => {
    it('should allow multiple hook instances', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');

      const { result: result1 } = renderHook(() => useVoiceInput({}));
      const { result: result2 } = renderHook(() => useVoiceInput({}));

      // Both should have independent state
      expect(result1.current.isListening).toBe(false);
      expect(result2.current.isListening).toBe(false);
    });
  });

  describe('Support Detection', () => {
    it('should have isSupported as boolean', async () => {
      const { useVoiceInput } = await import('@/app/hooks/use-voice-input');
      const { result } = renderHook(() => useVoiceInput({}));

      expect(typeof result.current.isSupported).toBe('boolean');
    });
  });
});
