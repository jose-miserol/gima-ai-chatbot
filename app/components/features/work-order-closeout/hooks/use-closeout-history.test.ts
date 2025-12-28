/**
 * useCloseoutHistory - Unit Tests
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useCloseoutHistory } from '@/app/components/features/work-order-closeout/hooks/use-closeout-history';
import type { CloseoutNotes } from '@/app/components/features/work-order-closeout/types';

describe('useCloseoutHistory', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Estado Inicial', () => {
    it('debe inicializar vacío', () => {
      const { result } = renderHook(() => useCloseoutHistory());
      expect(result.current.history).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('debe tener funciones disponibles', () => {
      const { result } = renderHook(() => useCloseoutHistory());

      expect(result.current.saveToHistory).toBeDefined();
      expect(typeof result.current.saveToHistory).toBe('function');
      expect(result.current.deleteFromHistory).toBeDefined();
      expect(typeof result.current.deleteFromHistory).toBe('function');
    });
  });

  describe('Guardar en Historial', () => {
    it('debe guardar notas', () => {
      const { result } = renderHook(() => useCloseoutHistory());

      const mockNotes: CloseoutNotes = {
        id: '123',
        workOrderId: 'wo-123',
        summary: 'Test summary',
        workPerformed: 'Test work',
        findings: 'Test findings',
        materialsUsed: 'Test materials',
        timeBreakdown: 'Test time',
        style: 'formal',
        createdAt: new Date(),
      };

      act(() => {
        result.current.saveToHistory('Test Entry', mockNotes);
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].name).toBe('Test Entry');
    });
  });
});
