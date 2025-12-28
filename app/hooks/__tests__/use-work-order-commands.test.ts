/**
 * Test Suite: useWorkOrderCommands Hook
 *
 * Tipo: Unit
 * Prioridad: Critical
 *
 * Cobertura:
 * - State transitions (idle → executing → succeeded/failed)
 * - Progress tracking (duration)
 * - Reset y Cancel functionality
 * - Propiedades derivadas (isExecuting, hasError, etc.)
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getWorkOrderService } from '@/app/lib/services/work-order-service';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

import { useWorkOrderCommands } from '../use-work-order-commands';


// Mock del servicio
vi.mock('@/app/lib/services/work-order-service', () => ({
  getWorkOrderService: vi.fn(() => ({
    create: vi.fn(),
  })),
}));

const mockService = {
  create: vi.fn(),
};

const validCommand: VoiceWorkOrderCommand = {
  type: 'work_order',
  action: 'create_work_order',
  equipment: 'Bomba #3',
  location: 'Sala de Máquinas',
  priority: 'urgent',
  description: 'Fuga detectada en sello mecánico',
  rawTranscript: 'crear orden para bomba tres',
  confidence: 0.95,
  assignee: undefined,
};

describe('useWorkOrderCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getWorkOrderService as ReturnType<typeof vi.fn>).mockReturnValue(mockService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Estado Inicial', () => {
    it('debe iniciar en estado idle', () => {
      const { result } = renderHook(() => useWorkOrderCommands());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.result).toBeNull();
      expect(result.current.state.error).toBeNull();
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Ejecución Exitosa', () => {
    it('debe transicionar idle → executing → succeeded', async () => {
      const mockResult = {
        success: true,
        message: 'Work order created',
        resourceId: 'wo-123',
      };
      mockService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useWorkOrderCommands());

      // Estado inicial
      expect(result.current.state.status).toBe('idle');

      // Ejecutar comando
      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.executeCommand(validCommand);
      });

      // Estado intermedio: executing
      expect(result.current.state.status).toBe('executing');
      expect(result.current.isExecuting).toBe(true);

      // Esperar resultado
      await act(async () => {
        await promise;
      });

      // Estado final: succeeded
      expect(result.current.state.status).toBe('succeeded');
      expect(result.current.state.result).toEqual(mockResult);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.state.duration).toBeGreaterThanOrEqual(0);
    });

    it('debe retornar el resultado del servicio', async () => {
      const mockResult = {
        success: true,
        message: 'Created',
        resourceId: 'wo-456',
      };
      mockService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useWorkOrderCommands());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.executeCommand(validCommand);
      });

      expect(returnedResult).toEqual(mockResult);
    });
  });

  describe('Ejecución Fallida', () => {
    it('debe transicionar idle → executing → failed en error', async () => {
      const mockError = new Error('Service unavailable');
      mockService.create.mockRejectedValue(mockError);

      const { result } = renderHook(() => useWorkOrderCommands());

      await act(async () => {
        try {
          await result.current.executeCommand(validCommand);
        } catch {
          // Error esperado
        }
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error).toEqual(mockError);
      expect(result.current.hasError).toBe(true);
      expect(result.current.isExecuting).toBe(false);
    });

    it('debe propagar el error al llamador', async () => {
      const mockError = new Error('Network error');
      mockService.create.mockRejectedValue(mockError);

      const { result } = renderHook(() => useWorkOrderCommands());

      await expect(
        act(async () => {
          await result.current.executeCommand(validCommand);
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Reset', () => {
    it('debe resetear estado a idle', async () => {
      const mockResult = { success: true, message: 'OK', resourceId: 'wo-1' };
      mockService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useWorkOrderCommands());

      // Ejecutar comando
      await act(async () => {
        await result.current.executeCommand(validCommand);
      });

      expect(result.current.state.status).toBe('succeeded');

      // Resetear
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.result).toBeNull();
      expect(result.current.state.error).toBeNull();
      expect(result.current.isIdle).toBe(true);
    });

    it('debe resetear después de un error', async () => {
      mockService.create.mockRejectedValue(new Error('Fail'));

      const { result } = renderHook(() => useWorkOrderCommands());

      await act(async () => {
        try {
          await result.current.executeCommand(validCommand);
        } catch {
          // Expected
        }
      });

      expect(result.current.hasError).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Cancel', () => {
    it('debe permitir cancelar y volver a idle', () => {
      const { result } = renderHook(() => useWorkOrderCommands());

      act(() => {
        result.current.cancel();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.error).toBeInstanceOf(Error);
      expect(result.current.state.error?.message).toContain('cancelada');
    });
  });

  describe('Propiedades Derivadas', () => {
    it('isExecuting debe ser true durante executing', async () => {
      // Usar una promesa que resuelve inmediatamente pero capturar el estado intermedio
      const mockResult = { success: true, message: 'OK' };
      mockService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useWorkOrderCommands());

      // Estado inicial
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.isIdle).toBe(true);

      // Iniciar ejecución y capturar estado intermedio
      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.executeCommand(validCommand);
      });

      // Durante ejecución (sincrónico después del act)
      expect(result.current.isExecuting).toBe(true);
      expect(result.current.isIdle).toBe(false);

      // Completar ejecución
      await act(async () => {
        await promise;
      });

      // Después de completar
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });

    it('hasError debe ser true solo cuando status es failed con error', async () => {
      mockService.create.mockRejectedValue(new Error('Fail'));

      const { result } = renderHook(() => useWorkOrderCommands());

      expect(result.current.hasError).toBe(false);

      await act(async () => {
        try {
          await result.current.executeCommand(validCommand);
        } catch {
          // Expected
        }
      });

      expect(result.current.hasError).toBe(true);
    });
  });

  describe('Tracking de Duración', () => {
    it('debe trackear la duración de la ejecución', async () => {
      // Usar mock que resuelve inmediatamente
      mockService.create.mockResolvedValue({ success: true, message: 'OK' });

      const { result } = renderHook(() => useWorkOrderCommands());

      await act(async () => {
        await result.current.executeCommand(validCommand);
      });

      // Verificar que se trackeó la duración (>= 0 ya que es instantáneo)
      expect(result.current.state.duration).toBeGreaterThanOrEqual(0);
      expect(result.current.state.startedAt).not.toBeNull();
      expect(typeof result.current.state.startedAt).toBe('number');
    });
  });
});
