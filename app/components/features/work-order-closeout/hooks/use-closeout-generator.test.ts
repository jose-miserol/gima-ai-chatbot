/**
 * useCloseoutGenerator - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCloseoutGenerator } from '@/app/components/features/work-order-closeout/hooks/use-closeout-generator';

describe('useCloseoutGenerator', () => {
  describe('Estado Inicial', () => {
    it('debe inicializar correctamente', () => {
      const { result } = renderHook(() => useCloseoutGenerator());

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.notes).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });

    it('debe tener función generate', () => {
      const { result } = renderHook(() => useCloseoutGenerator());
      expect(result.current.generate).toBeDefined();
      expect(typeof result.current.generate).toBe('function');
    });

    it('debe tener función reset', () => {
      const { result } = renderHook(() => useCloseoutGenerator());
      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });
  });
});
