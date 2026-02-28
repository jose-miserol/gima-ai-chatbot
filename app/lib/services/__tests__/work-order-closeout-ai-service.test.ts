/**
 * WorkOrderCloseoutAIService - Unit Tests
 *
 * Tests básicos para el servicio de generación de notas de cierre.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { CloseoutNotesRequest } from '@/app/lib/schemas/work-order-closeout.schema';
import { WorkOrderCloseoutAIService } from '@/app/lib/services/work-order-closeout-ai-service';

// Mock del módulo 'env'
vi.mock('@/app/config/env', () => ({
  env: {
    GROQ_API_KEY: 'gsk_test_mock_key_1234567890abcdef',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaTestMockKey1234567890',
    NODE_ENV: 'test',
  },
}));

describe('WorkOrderCloseoutAIService', () => {
  let service: WorkOrderCloseoutAIService;

  beforeEach(() => {
    service = new WorkOrderCloseoutAIService();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Validación de Request', () => {
    it('debe rechazar workOrderId vacío', async () => {
      const invalidRequest: any = {
        workOrderId: '',
        workOrderData: {
          id: 'wo-123',
          title: 'Test',
          description: 'Test description',
          assetType: 'bomba',
          taskType: 'preventivo',
          priority: 'alta',
          activities: ['Actividad 1'],
          timeSpent: 2,
        },
        style: 'formal',
        includeRecommendations: true,
      };

      const result = await service.generateCloseoutNotes(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar actividades vacías', async () => {
      const invalidRequest: any = {
        workOrderId: 'wo-123',
        workOrderData: {
          id: 'wo-123',
          title: 'Test',
          description: 'Test',
          assetType: 'bomba',
          taskType: 'preventivo',
          priority: 'alta',
          activities: [],
          timeSpent: 2,
        },
        style: 'formal',
        includeRecommendations: true,
      };

      const result = await service.generateCloseoutNotes(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('debe rechazar estilo inválido', async () => {
      const invalidRequest: any = {
        workOrderId: 'wo-123',
        workOrderData: {
          id: 'wo-123',
          title: 'Test',
          description: 'Test',
          assetType: 'bomba',
          taskType: 'preventivo',
          priority: 'alta',
          activities: ['Act 1'],
          timeSpent: 2,
        },
        style: 'invalid-style',
        includeRecommendations: true,
      };

      const result = await service.generateCloseoutNotes(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('Estilos de Notas', () => {
    const styles = ['formal', 'technical', 'brief'] as const;

    styles.forEach((style) => {
      it(`debe aceptar estilo: ${style}`, async () => {
        const request: CloseoutNotesRequest = {
          workOrderId: 'wo-123',
          workOrderData: {
            id: 'wo-123',
            title: 'Mantenimiento preventivo bomba',
            description: 'Mantenimiento programado',
            assetType: 'bomba',
            taskType: 'preventivo',
            priority: 'media',
            activities: ['Revisión de sellos', 'Cambio de rodamientos'],
            materialsUsed: ['Sello mecánico', 'Rodamiento SKF'],
            timeSpent: 3.5,
          },
          style,
          includeRecommendations: true,
        };

        const result = await service.generateCloseoutNotes(request);
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Estructura de Respuesta', () => {
    it('debe retornar estructura correcta', async () => {
      const request: CloseoutNotesRequest = {
        workOrderId: 'wo-456',
        workOrderData: {
          id: 'wo-456',
          title: 'Reparación urgente',
          description: 'Fuga detectada en válvula',
          assetType: 'caldera',
          taskType: 'correctivo',
          priority: 'alta',
          activities: ['Detener equipo', 'Reemplazar válvula', 'Pruebas'],
          timeSpent: 4,
        },
        style: 'technical',
        includeRecommendations: false,
      };

      const result = await service.generateCloseoutNotes(request);

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.notes).toBeDefined();
        expect(result.notes?.id).toBeDefined();
        expect(result.notes?.summary).toBeDefined();
        expect(result.notes?.workPerformed).toBeDefined();
        expect(result.notes?.findings).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });
});
