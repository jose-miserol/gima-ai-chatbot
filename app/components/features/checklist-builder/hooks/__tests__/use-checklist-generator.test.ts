/**
 * useChecklistGenerator - Unit Tests
 *
 * Tests para el hook de generación de checklists.
 * Verifica estados iniciales y funciones disponibles.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useChecklistGenerator } from '@/app/components/features/checklist-builder/hooks/use-checklist-generator';

describe('useChecklistGenerator', () => {
  describe('Estado Inicial', () => {
    it('debe inicializar con estado correcto', () => {
      const { result } = renderHook(() => useChecklistGenerator());

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.checklist).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });

    it('debe tener función generate disponible', () => {
      const { result } = renderHook(() => useChecklistGenerator());

      expect(result.current.generate).toBeDefined();
      expect(typeof result.current.generate).toBe('function');
    });

    it('debe tener función reset disponible', () => {
      const { result } = renderHook(() => useChecklistGenerator());

      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Función Reset', () => {
    it('debe resetear todo el estado a valores iniciales', () => {
      const { result } = renderHook(() => useChecklistGenerator());

      // Ejecutar reset
      result.current.reset();

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.checklist).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });

  describe('Estructura del Hook', () => {
    it('debe retornar todas las propiedades esperadas', () => {
      const { result } = renderHook(() => useChecklistGenerator());

      expect(result.current).toHaveProperty('isGenerating');
      expect(result.current).toHaveProperty('checklist');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('progress');
      expect(result.current).toHaveProperty('generate');
      expect(result.current).toHaveProperty('reset');
    });
  });
});
