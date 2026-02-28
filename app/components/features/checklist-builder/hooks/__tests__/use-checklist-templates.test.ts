/**
 * useChecklistTemplates - Unit Tests
 *
 * Tests para el hook de gestión de templates.
 * Verifica localStorage, CRUD operations y límites.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useChecklistTemplates } from '@/app/components/features/checklist-builder/hooks/use-checklist-templates';
import type { Checklist } from '@/app/components/features/checklist-builder/types';

describe('useChecklistTemplates', () => {
  beforeEach(() => {
    // Clear localStorage antes de cada test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Estado Inicial', () => {
    it('debe inicializar con templates vacío', () => {
      const { result } = renderHook(() => useChecklistTemplates());

      expect(result.current.templates).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('debe tener todas las funciones disponibles', () => {
      const { result } = renderHook(() => useChecklistTemplates());

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
      const { result } = renderHook(() => useChecklistTemplates());

      const mockChecklist: Checklist = {
        id: '123',
        title: 'Test Checklist',
        description: 'Test description',
        assetType: 'bomba',
        taskType: 'preventivo',
        items: [],
        createdAt: new Date(),
        isTemplate: false,
      };

      act(() => {
        result.current.saveTemplate('Mi Template', mockChecklist);
      });

      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].name).toBe('Mi Template');
      expect(result.current.templates[0].usageCount).toBe(0);
    });

    it('debe incrementar usageCount', () => {
      const { result } = renderHook(() => useChecklistTemplates());

      const mockChecklist: Checklist = {
        id: '123',
        title: 'Test',
        description: 'Test',
        assetType: 'bomba',
        taskType: 'preventivo',
        items: [],
        createdAt: new Date(),
        isTemplate: false,
      };

      act(() => {
        result.current.saveTemplate('Template 1', mockChecklist);
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
      const { result } = renderHook(() => useChecklistTemplates());

      const mockChecklist: Checklist = {
        id: '123',
        title: 'Test',
        description: 'Test',
        assetType: 'bomba',
        taskType: 'preventivo',
        items: [],
        createdAt: new Date(),
        isTemplate: false,
      };

      act(() => {
        result.current.saveTemplate('Template to Delete', mockChecklist);
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
      const { result } = renderHook(() => useChecklistTemplates());

      const mockChecklist: Checklist = {
        id: '123',
        title: 'Test',
        description: 'Test',
        assetType: 'bomba',
        taskType: 'preventivo',
        items: [],
        createdAt: new Date(),
        isTemplate: false,
      };

      act(() => {
        result.current.saveTemplate('Test Template', mockChecklist);
      });

      const templateId = result.current.templates[0].id;
      const template = result.current.getTemplate(templateId);

      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
    });

    it('debe retornar undefined para ID inexistente', () => {
      const { result } = renderHook(() => useChecklistTemplates());

      const template = result.current.getTemplate('non-existent-id');

      expect(template).toBeUndefined();
    });
  });
});
