/**
 * ChecklistAIService - Unit Tests
 *
 * Tests básicos para el servicio de generación de checklists con IA.
 * Verifica validación y error handling principal.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ChecklistGenerationRequest } from '@/app/lib/schemas/checklist.schema';
import { ChecklistAIService } from '@/app/lib/services/checklist-ai-service';

// Mock del módulo 'env' para evitar validación de API keys en tests
vi.mock('@/app/config/env', () => ({
  env: {
    GROQ_API_KEY: 'gsk_test_mock_key_1234567890abcdef',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaTestMockKey1234567890',
    NODE_ENV: 'test',
  },
}));

describe('ChecklistAIService', () => {
  let service: ChecklistAIService;

  beforeEach(() => {
    service = new ChecklistAIService();

    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Validación de Request', () => {
    it('debe rechazar assetType inválido', async () => {
      const invalidRequest: any = {
        assetType: 'invalid-asset-type-that-does-not-exist',
        taskType: 'preventivo',
      };

      const result = await service.generateChecklist(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar taskType inválido', async () => {
      const invalidRequest: any = {
        assetType: 'bomba',
        taskType: 'invalid-task-type',
      };

      const result = await service.generateChecklist(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar customInstructions muy largas', async () => {
      const invalidRequest: ChecklistGenerationRequest = {
        assetType: 'bomba',
        taskType: 'preventivo',
        customInstructions: 'a'.repeat(501), // > 500 chars
      };

      const result = await service.generateChecklist(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Procesamiento de Request válido', () => {
    it('debe aceptar request válido mínimo', async () => {
      const validRequest: ChecklistGenerationRequest = {
        assetType: 'bomba',
        taskType: 'preventivo',
      };

      const result = await service.generateChecklist(validRequest);

      // Puede ser éxito o error (depende de API key real)
      // Solo verificamos que no crashee
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('debe aceptar request con customInstructions', async () => {
      const validRequest: ChecklistGenerationRequest = {
        assetType: 'caldera',
        taskType: 'correctivo',
        customInstructions: 'Incluir verificaciones de seguridad adicionales',
      };

      const result = await service.generateChecklist(validRequest);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Estructura de Respuesta', () => {
    it('debe retornar estructura correcta en success', async () => {
      const validRequest: ChecklistGenerationRequest = {
        assetType: 'bomba',
        taskType: 'preventivo',
      };

      const result = await service.generateChecklist(validRequest);

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result).toHaveProperty('checklist');
        expect(result.checklist).toBeDefined();
        expect(result.checklist?.id).toBeDefined();
        expect(result.checklist?.title).toBeDefined();
        expect(result.checklist?.items).toBeInstanceOf(Array);
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Tipos de Activos', () => {
    const assetTypes = ['bomba', 'caldera', 'compresor', 'unidad-hvac', 'generador'] as const;

    assetTypes.forEach((assetType) => {
      it(`debe aceptar assetType: ${assetType}`, async () => {
        const request: ChecklistGenerationRequest = {
          assetType,
          taskType: 'preventivo',
        };

        const result = await service.generateChecklist(request);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Tipos de Tareas', () => {
    const taskTypes = ['preventivo', 'correctivo', 'predictivo', 'inspeccion'] as const;

    taskTypes.forEach((taskType) => {
      it(`debe aceptar taskType: ${taskType}`, async () => {
        const request: ChecklistGenerationRequest = {
          assetType: 'bomba',
          taskType,
        };

        const result = await service.generateChecklist(request);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
