import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVoiceNavigation } from '../hooks/use-voice-navigation';
import { useVoiceSystem } from '../hooks/use-voice-system';

// Mocks
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
    theme: 'light',
  }),
}));

describe('Voice Hooks Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useVoiceNavigation', () => {
    it('should navigate to home screen', () => {
      const { result } = renderHook(() => useVoiceNavigation());

      act(() => {
        result.current.navigate({
          type: 'navigation',
          screen: 'home',
          confidence: 0.9,
          rawTranscript: 'ir a inicio',
        });
      });
      expect(mockRouterPush).toHaveBeenCalledWith('/');
    });

    it('should navigate to tools screen', () => {
      const { result } = renderHook(() => useVoiceNavigation());

      act(() => {
        result.current.navigate({
          type: 'navigation',
          screen: 'herramientas',
          confidence: 0.9,
          rawTranscript: 'ir a herramientas',
        });
      });
      expect(mockRouterPush).toHaveBeenCalledWith('/tools');
    });

    it('should navigate to checklist builder', () => {
      const { result } = renderHook(() => useVoiceNavigation());

      act(() => {
        result.current.navigate({
          type: 'navigation',
          screen: 'checklist',
          confidence: 0.9,
          rawTranscript: 'crear lista',
        });
      });
      expect(mockRouterPush).toHaveBeenCalledWith('/tools/checklist-builder');
    });

    it('should handle unknown screens gracefully', () => {
      const { result } = renderHook(() => useVoiceNavigation());

      let response;
      act(() => {
        response = result.current.navigate({
          type: 'navigation',
          screen: 'unknown_screen',
          confidence: 0.9,
          rawTranscript: 'ir a lugar desconocido',
        });
      });

      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(response?.success).toBe(false);
    });
  });

  describe('useVoiceSystem', () => {
    it('should toggle theme', () => {
      const { result } = renderHook(() => useVoiceSystem());

      act(() => {
        result.current.executeSystem({
          type: 'system',
          action: 'toggle_theme',
          confidence: 0.9,
          rawTranscript: 'cambiar tema',
        });
      });

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should handle logout', () => {
      const { result } = renderHook(() => useVoiceSystem());

      let response;
      act(() => {
        response = result.current.executeSystem({
          type: 'system',
          action: 'logout',
          confidence: 0.9,
          rawTranscript: 'cerrar sesión',
        });
      });

      expect(response?.success).toBe(true);
      expect(response?.message).toContain('cerrada');
    });
  });
});
