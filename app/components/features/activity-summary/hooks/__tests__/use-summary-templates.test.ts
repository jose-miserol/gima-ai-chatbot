/**
 * useSummaryTemplates - Unit Tests
 *
 * Tests para el hook de gestión de templates de resúmenes.
 * Verifica localStorage y operaciones CRUD.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useSummaryTemplates } from '@/app/components/features/activity-summary/hooks/use-summary-templates';
import type { ActivitySummary } from '@/app/components/features/activity-summary/types';

describe('useSummaryTemplates', () => {
  beforeEach(() => {
    // Clear localStorage antes de cada test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Estado Inicial', () => {
    it('debe inicializar con templates vacío', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      expect(result.current.templates).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('debe tener todas las funciones disponibles', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      expect(result.current.saveTemplate).toBeDefined();
      expect(typeof result.current.saveTemplate).toBe('function');
      expect(result.current.deleteTemplate).toBeDefined();
      expect(typeof result.current.deleteTemplate).toBe('function');
      expect(result.current.incrementUsage).toBeDefined();
      expect(typeof result.current.incrementUsage).toBe('function');
      expect(result.current.getTemplate).toBeDefined();
      expect(typeof result.current.getTemplate).toBe('function');
    });
  });

  describe('Guardar Template', () => {
    it('debe guardar nuevo template', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      const mockSummary: ActivitySummary = {
        id: '123',
        title: 'Test Summary',
        executive: 'Test executive summary',
        sections: [],
        assetType: 'bomba',
        taskType: 'preventivo',
        style: 'tecnico',
        detailLevel: 'medio',
        createdAt: new Date(),
      };

      act(() => {
        result.current.saveTemplate('Mi Template', mockSummary);
      });

      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].name).toBe('Mi Template');
      expect(result.current.templates[0].usageCount).toBe(0);
    });

    it('debe incrementar usageCount', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      const mockSummary: ActivitySummary = {
        id: '123',
        title: 'Test',
        executive: 'Test',
        sections: [],
        assetType: 'bomba',
        taskType: 'preventivo',
        style: 'tecnico',
        detailLevel: 'medio',
        createdAt: new Date(),
      };

      act(() => {
        result.current.saveTemplate('Template 1', mockSummary);
      });

      const templateId = result.current.templates[0].id;

      act(() => {
        result.current.incrementUsage(templateId);
      });

      expect(result.current.templates[0].usageCount).toBe(1);
    });
  });

  describe('Eliminar Template', () => {
    it('debe eliminar template por ID', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      const mockSummary: ActivitySummary = {
        id: '123',
        title: 'Test',
        executive: 'Test',
        sections: [],
        assetType: 'bomba',
        taskType: 'preventivo',
        style: 'tecnico',
        detailLevel: 'medio',
        createdAt: new Date(),
      };

      act(() => {
        result.current.saveTemplate('Template to Delete', mockSummary);
      });

      const templateId = result.current.templates[0].id;

      expect(result.current.templates).toHaveLength(1);

      act(() => {
        result.current.deleteTemplate(templateId);
      });

      expect(result.current.templates).toHaveLength(0);
    });
  });

  describe('Obtener Template', () => {
    it('debe retornar template por ID', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      const mockSummary: ActivitySummary = {
        id: '123',
        title: 'Test',
        executive: 'Test',
        sections: [],
        assetType: 'bomba',
        taskType: 'preventivo',
        style: 'tecnico',
        detailLevel: 'medio',
        createdAt: new Date(),
      };

      act(() => {
        result.current.saveTemplate('Test Template', mockSummary);
      });

      const templateId = result.current.templates[0].id;
      const template = result.current.getTemplate(templateId);

      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
    });

    it('debe retornar undefined para ID inexistente', () => {
      const { result } = renderHook(() => useSummaryTemplates());

      const template = result.current.getTemplate('non-existent-id');

      expect(template).toBeUndefined();
    });
  });
});
