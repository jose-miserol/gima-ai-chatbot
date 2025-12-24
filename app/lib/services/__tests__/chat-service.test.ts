import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService, RateLimitError, ValidationError } from '../chat-service';
import { MockAiSdk } from '@/tests/mocks/ai-sdk';

// Mock dependencies
const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

const mockRateLimiter = {
  checkLimit: vi.fn(),
  getRetryAfter: vi.fn(),
} as any;

const mockModelProvider = vi.fn();

describe.skip('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService({
      logger: mockLogger,
      rateLimiter: mockRateLimiter,
      modelProvider: mockModelProvider,
    });

    // Default mocks
    mockRateLimiter.checkLimit.mockReturnValue(true);
    // Mock the model provider to return a dummy model object
    mockModelProvider.mockReturnValue({ provider: 'test', modelId: 'test-model' });

    // Mock streamText via factory or direct module mock if possible
    // Since streamText is imported in ChatService, we must mock 'ai' module
  });

  // We need to mock 'ai' module at the top level
  vi.mock('ai', () => ({
    streamText: vi.fn((args) => MockAiSdk.streamText(args)),
  }));

  it('should throw RateLimitError if limit is reached', async () => {
    mockRateLimiter.checkLimit.mockReturnValue(false);
    mockRateLimiter.getRetryAfter.mockReturnValue(5000);

    await expect(service.processMessage({}, '127.0.0.1')).rejects.toThrow(RateLimitError);

    expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('127.0.0.1');
  });

  it('should throw ValidationError if body is invalid', async () => {
    await expect(service.processMessage({ invalid: 'field' }, '127.0.0.1')).rejects.toThrow(
      ValidationError
    );
  });

  it('should call streamText with correct parameters on valid request', async () => {
    const validBody = {
      messages: [{ role: 'user', content: 'hello' }],
      model: 'llama-3.3-70b-versatile',
    };

    // Mock streamText result
    const mockResult = { toUIMessageStreamResponse: vi.fn() };
    MockAiSdk.streamText.mockReturnValue(mockResult);

    const result = await service.processMessage(validBody, '127.0.0.1');

    expect(result).toBe(mockResult);
    expect(MockAiSdk.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.any(String),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'hello' }),
        ]),
      })
    );
  });
});
