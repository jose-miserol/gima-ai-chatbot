/**
 * Test Suite: WorkOrderService
 *
 * Tipo: Unit
 * Prioridad: Critical
 *
 * Cobertura de Requisitos:
 * - [REQ-001]: Creación de órdenes con validación Zod
 * - [REQ-002]: Retry logic con backoff exponencial
 * - [REQ-003]: Error handling con códigos estandarizados
 * - [REQ-004]: Timeout automático por request
 * - [REQ-005]: Observabilidad con correlation IDs
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Mock environment variables ANTES de importar el servicio
beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_API_URL', 'https://api.mock.com');
  vi.stubEnv('BACKEND_API_KEY', 'mock-api-key-123');
});

import { WorkOrderService } from '../work-order-service';
import {
  WorkOrderError,
  RateLimitError,
  TimeoutError,
  ServiceUnavailableError,
} from '../contracts/work-order-service.contracts';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

// Mock factory para logger
const createMockLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// Mock factory para crypto
const createMockCrypto = () => ({
  randomUUID: vi.fn(() => 'mocked-uuid-123'),
});

// Mock factory para clock
const createMockClock = () => ({
  now: vi.fn(() => Date.now()),
});

/**
 * Mock factory para timers controlables
 * Integra perfectamente con vi.useFakeTimers()
 */
const createMockTimer = () => ({
  setTimeout: vi.fn((cb: () => void, ms: number) => {
    return setTimeout(cb, ms); // Usa el setTimeout mockeado por Vitest
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearTimeout: vi.fn((id: any) => {
    clearTimeout(id);
  }),
});

/**
 * Mock factory para AbortController testeable
 */
const createMockAbortFactory = () => {
  const contexts: Array<{
    controller: AbortController;
    timeoutId: ReturnType<typeof setTimeout> | null;
    abort: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    factory: {
      create: () => {
        const controller = new AbortController();
        const context = {
          controller,
          timeoutId: null as ReturnType<typeof setTimeout> | null,
          abort: vi.fn(() => {
            controller.abort();
          }),
        };
        contexts.push(context);
        return context;
      },
    },
    contexts, // Exponer para assertions
  };
};

// Comando válido para tests
const validCommand: VoiceWorkOrderCommand = {
  action: 'create_work_order',
  equipment: 'Bomba #3',
  location: 'Sala de Máquinas',
  priority: 'urgent',
  description: 'Fuga detectada en sello mecánico',
  rawTranscript: 'crear orden para bomba tres en sala de máquinas',
  confidence: 0.95,
  assignee: undefined,
};

const validContext = {
  userId: 'user-123',
  correlationId: 'test-correlation-id',
};

const defaultConfig = {
  baseUrl: 'https://api.test.com',
  apiKey: 'test-api-key',
  timeoutMs: 30000,
  maxRetries: 3,
};

describe('WorkOrderService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockCrypto: ReturnType<typeof createMockCrypto>;
  let mockClock: ReturnType<typeof createMockClock>;
  let mockTimer: ReturnType<typeof createMockTimer>;
  let mockAbortFactory: ReturnType<typeof createMockAbortFactory>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    mockFetch = vi.fn();
    mockLogger = createMockLogger();
    mockCrypto = createMockCrypto();
    mockClock = createMockClock();
    mockTimer = createMockTimer();
    mockAbortFactory = createMockAbortFactory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper para crear servicio con todas las dependencias mockeadas
  const createService = (configOverrides = {}) =>
    new WorkOrderService(
      { ...defaultConfig, ...configOverrides },
      {
        fetchImpl: mockFetch as unknown as typeof fetch,
        loggerImpl: mockLogger,
        cryptoImpl: mockCrypto as unknown as Pick<Crypto, 'randomUUID'>,
        clockImpl: mockClock,
        timerImpl: mockTimer,
        abortFactory: mockAbortFactory.factory,
      }
    );

  describe('Constructor Validation', () => {
    it('debe rechazar config sin baseUrl', () => {
      expect(
        () =>
          new WorkOrderService({
            ...defaultConfig,
            baseUrl: '',
          })
      ).toThrow('baseUrl es requerido');
    });

    it('debe rechazar config sin apiKey', () => {
      expect(
        () =>
          new WorkOrderService({
            ...defaultConfig,
            apiKey: '',
          })
      ).toThrow('apiKey es requerido');
    });

    it('debe rechazar config con timeoutMs negativo', () => {
      expect(
        () =>
          new WorkOrderService({
            ...defaultConfig,
            timeoutMs: -1,
          })
      ).toThrow('timeoutMs debe ser > 0');
    });

    it('debe rechazar config con maxRetries negativo', () => {
      expect(
        () =>
          new WorkOrderService({
            ...defaultConfig,
            maxRetries: -1,
          })
      ).toThrow('maxRetries debe ser >= 0');
    });
  });

  describe('Success Flow', () => {
    it('debe crear work order correctamente', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'wo-123',
          message: 'Work order created',
        }),
      });

      const result = await service.create(validCommand, validContext);

      expect(result).toMatchObject({
        success: true,
        resourceId: 'wo-123',
        message: expect.stringContaining('created'),
      });

      // Verificar headers del request
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-api-key',
        'X-Correlation-ID': 'test-correlation-id',
      });
    });

    it('debe generar correlation ID si no existe', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'wo-123' }),
      });

      await service.create(validCommand, {
        userId: 'user-1',
        correlationId: '',
      });

      expect(mockCrypto.randomUUID).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          correlationId: 'mocked-uuid-123',
        })
      );
    });

    it('debe sanitizar input con Zod', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'wo-123' }),
      });

      await service.create(
        {
          ...validCommand,
          equipment: '  Bomba #3  ', // Con espacios
          priority: undefined, // Sin prioridad → debe usar default
        },
        validContext
      );

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.equipment).toBe('Bomba #3'); // Trimmed
      expect(body.priority).toBe('normal'); // Default
      expect(body.voiceMetadata).toMatchObject({
        rawTranscript: validCommand.rawTranscript,
        confidence: validCommand.confidence,
        timestamp: expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it.each([
      {
        status: 400,
        body: { message: 'Invalid equipment name' },
        expectedCode: 'VALIDATION_ERROR',
        expectedRecoverable: false,
      },
      {
        status: 401,
        body: { message: 'Invalid API key' },
        expectedCode: 'UNAUTHORIZED',
        expectedRecoverable: false,
      },
      {
        status: 403,
        body: { message: 'User not authorized' },
        expectedCode: 'FORBIDDEN',
        expectedRecoverable: false,
      },
      {
        status: 404,
        body: { message: 'Endpoint not found' },
        expectedCode: 'NOT_FOUND',
        expectedRecoverable: false,
      },
    ])(
      'debe manejar HTTP $status correctamente',
      async ({ status, body, expectedCode, expectedRecoverable }) => {
        // Usar maxRetries: 1 para errores no recuperables
        const service = createService({ maxRetries: 1 });

        mockFetch.mockResolvedValue({
          ok: false,
          status,
          headers: new Map(),
          json: async () => body,
        });

        const error = await service.create(validCommand, validContext).catch((e) => e);

        expect(error).toBeInstanceOf(WorkOrderError);
        expect(error.code).toBe(expectedCode);
        expect(error.recoverable).toBe(expectedRecoverable);
      }
    );

    it('debe manejar HTTP 429 con Retry-After', async () => {
      const service = createService({ maxRetries: 1 });

      const headersMap = new Map([['Retry-After', '120']]);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => headersMap.get(key) || null,
        },
        json: async () => ({ message: 'Too many requests' }),
      });

      const error = await service.create(validCommand, validContext).catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.retryAfter).toBe(120);
    });

    it('debe manejar HTTP 503 correctamente', async () => {
      const service = createService({ maxRetries: 1 });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Map(),
        json: async () => ({ message: 'Service maintenance' }),
      });

      const error = await service.create(validCommand, validContext).catch((e) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.recoverable).toBe(true);
    });

    it('debe rechazar input inválido con Zod', async () => {
      const service = createService();

      await expect(
        service.create(
          {
            ...validCommand,
            equipment: '', // Vacío → debe fallar validación
          },
          validContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Timeout Handling', () => {
    it('debe abortar request tras timeoutMs', async () => {
      const service = createService({ timeoutMs: 5000, maxRetries: 1 });

      // Mock fetch que nunca resuelve pero respeta el signal
      mockFetch.mockImplementation(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      );

      const promise = service.create(validCommand, validContext);

      // Verificar que se programó el timeout con timerImpl
      expect(mockTimer.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);

      // Avanzar tiempo hasta el timeout
      await vi.advanceTimersByTimeAsync(5000);

      // Verificar que se llamó abort
      expect(mockAbortFactory.contexts[0].abort).toHaveBeenCalled();

      // Verificar que el request falló con TimeoutError
      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it('debe limpiar timeout si request completa antes', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'wo-123' }),
      });

      await service.create(validCommand, validContext);

      // Verificar que se limpió el timeout
      expect(mockTimer.clearTimeout).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('debe reintentar en error 503 con backoff exponencial', async () => {
      const service = createService({ maxRetries: 3 });

      // Mock secuencial: falla 2 veces, luego éxito
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Map(),
          json: async () => ({ message: 'Service unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Map(),
          json: async () => ({ message: 'Still unavailable' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'wo-123', message: 'Created' }),
        });

      const promise = service.create(validCommand, validContext);

      // Primer intento (inmediato) - falla
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verificar que se programó backoff: 2^1 * 1000 = 2000ms
      expect(mockTimer.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

      // Avanzar al segundo intento
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verificar backoff: 2^2 * 1000 = 4000ms
      expect(mockTimer.setTimeout).toHaveBeenCalledWith(expect.any(Function), 4000);

      // Avanzar al tercer intento (exitoso)
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.resourceId).toBe('wo-123');
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verificar logs de retry
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retrying request',
        expect.objectContaining({
          attempt: 1,
          backoffMs: 2000,
          errorCode: 'SERVICE_UNAVAILABLE',
        })
      );
    });

    it('debe fallar tras maxRetries intentos', async () => {
      const service = createService({ maxRetries: 3 });

      // Mock que siempre falla con 503
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Map(),
        json: async () => ({ message: 'Service down' }),
      });

      const promise = service.create(validCommand, validContext);

      // Intento 1
      await vi.advanceTimersByTimeAsync(100);

      // Backoff 1: 2^1 * 1000 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);

      // Intento 2
      await vi.advanceTimersByTimeAsync(100);

      // Backoff 2: 2^2 * 1000 = 4000ms
      await vi.advanceTimersByTimeAsync(4000);

      // Intento 3 (último)
      await vi.advanceTimersByTimeAsync(100);

      // No debe haber más intentos
      await expect(promise).rejects.toThrow(ServiceUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('NO debe reintentar en errores no recuperables (400)', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Map(),
        json: async () => ({ message: 'Bad request' }),
      });

      await expect(service.create(validCommand, validContext)).rejects.toThrow(WorkOrderError);

      // Solo 1 intento, sin retries
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Observability', () => {
    it('debe loggear con contexto completo en éxito', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'wo-123' }),
      });

      await service.create(validCommand, validContext);

      // Log de inicio
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorkOrder creation started',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: 'user-123',
          action: 'create_work_order',
          equipment: 'Bomba #3',
        })
      );

      // Log de éxito
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WorkOrder created successfully',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          resourceId: 'wo-123',
          duration: expect.any(Number),
        })
      );
    });

    it('debe loggear con contexto completo en error', async () => {
      // Usar maxRetries: 1 para error no recuperable
      const service = createService({ maxRetries: 1 });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Map(),
        json: async () => ({ message: 'Bad request' }),
      });

      await service.create(validCommand, validContext).catch(() => {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WorkOrder creation failed',
        expect.any(Error),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: 'user-123',
          duration: expect.any(Number),
          equipment: 'Bomba #3',
        })
      );
    });

    it('debe medir duración correctamente', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'wo-123' }),
      });

      const result = await service.create(validCommand, validContext);

      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Additional Methods', () => {
    it('checkStatus: debe consultar estado correctamente', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'in_progress', assignee: 'Tech-1' }),
      });

      const result = await service.checkStatus('wo-123', validContext);

      expect(result).toMatchObject({
        success: true,
        resourceId: 'wo-123',
        message: expect.stringContaining('in_progress'),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/work-orders/wo-123/status',
        expect.any(Object)
      );
    });

    it('listPending: debe listar órdenes pendientes', async () => {
      const service = createService();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [{}, {}, {}], total: 3 }),
      });

      const result = await service.listPending(validContext);

      expect(result.message).toContain('3 pending orders');
      expect(result.metadata?.items).toHaveLength(3);
    });
  });
});
