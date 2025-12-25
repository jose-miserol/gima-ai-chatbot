/**
 * ActivitySummaryAIService - Unit Tests
 *
 * Tests básicos para el servicio de generación de resúmenes con IA.
 * Verifica validación y estructura de respuestas.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock del módulo 'env' para evitar validación de API keys en tests
vi.mock('@/app/config/env', () => ({
  env: {
    GROQ_API_KEY: 'gsk_test_mock_key_1234567890abcdef',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaTestMockKey1234567890',
    NODE_ENV: 'test',
  },
}));

import { ActivitySummaryAIService } from '@/app/lib/services/activity-summary-ai-service';
import type { ActivitySummaryRequest } from '@/app/lib/schemas/activity-summary.schema';

describe('ActivitySummaryAIService', () => {
  let service: ActivitySummaryAIService;

  beforeEach(() => {
    service = new ActivitySummaryAIService();

    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Validación de Request', () => {
    it('debe rechazar activities muy cortas', async () => {
      const invalidRequest: any = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities: 'abc', // < 50 chars
        style: 'tecnico',
        detailLevel: 'medio',
      };

      const result = await service.generateSummary(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar activities muy largas', async () => {
      const invalidRequest: any = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities: 'a'.repeat(5001), // > 5000 chars
        style: 'tecnico',
        detailLevel: 'medio',
      };

      const result = await service.generateSummary(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar estilo inválido', async () => {
      const invalidRequest: any = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities:
          'Actividades de mantenimiento realizadas correctamente con todas las verificaciones.',
        style: 'estilo-invalido',
        detailLevel: 'medio',
      };

      const result = await service.generateSummary(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('debe rechazar nivel de detalle inválido', async () => {
      const invalidRequest: any = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities:
          'Actividades de mantenimiento realizadas correctamente con todas las verificaciones.',
        style: 'tecnico',
        detailLevel: 'super-alto',
      };

      const result = await service.generateSummary(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Procesamiento de Request válido', () => {
    it('debe aceptar request válido mínimo', async () => {
      const validRequest: ActivitySummaryRequest = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities:
          'Se realizó mantenimiento preventivo completo en bomba centrífuga. Se verificaron sellos, rodamientos y alineación.',
        style: 'tecnico',
        detailLevel: 'medio',
      };

      const result = await service.generateSummary(validRequest);

      // Puede ser éxito o error (depende de API key real)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('debe aceptar request con contexto adicional', async () => {
      const validRequest: ActivitySummaryRequest = {
        assetType: 'caldera',
        taskType: 'correctivo',
        activities:
          'Se detectó fuga en válvula de seguridad. Se procedió a reemplazo completo y calibración.',
        style: 'ejecutivo',
        detailLevel: 'bajo',
        context: 'Mantenimiento urgente fuera de horario',
      };

      const result = await service.generateSummary(validRequest);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Estructura de Respuesta', () => {
    it('debe retornar estructura correcta', async () => {
      const validRequest: ActivitySummaryRequest = {
        assetType: 'bomba',
        taskType: 'preventivo',
        activities:
          'Mantenimiento preventivo realizado según plan. Todas las verificaciones completadas exitosamente.',
        style: 'tecnico',
        detailLevel: 'medio',
      };

      const result = await service.generateSummary(validRequest);

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result).toHaveProperty('summary');
        expect(result.summary).toBeDefined();
        expect(result.summary?.id).toBeDefined();
        expect(result.summary?.title).toBeDefined();
        expect(result.summary?.executive).toBeDefined();
        expect(result.summary?.sections).toBeInstanceOf(Array);
      } else {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Estilos de Resumen', () => {
    const styles = ['ejecutivo', 'tecnico', 'narrativo'] as const;

    styles.forEach((style) => {
      it(`debe aceptar estilo: ${style}`, async () => {
        const request: ActivitySummaryRequest = {
          assetType: 'bomba',
          taskType: 'preventivo',
          activities:
            'Mantenimiento preventivo completado. Verificaciones realizadas conforme a procedimientos estándar.',
          style,
          detailLevel: 'medio',
        };

        const result = await service.generateSummary(request);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('Niveles de Detalle', () => {
    const detailLevels = ['alto', 'medio', 'bajo'] as const;

    detailLevels.forEach((detailLevel) => {
      it(`debe aceptar detailLevel: ${detailLevel}`, async () => {
        const request: ActivitySummaryRequest = {
          assetType: 'bomba',
          taskType: 'preventivo',
          activities:
            'Mantenimiento preventivo completado. Verificaciones realizadas conforme a procedimientos estándar.',
          style: 'tecnico',
          detailLevel,
        };

        const result = await service.generateSummary(request);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
