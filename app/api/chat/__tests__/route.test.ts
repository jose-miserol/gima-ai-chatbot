import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ChatService, RateLimitError, ValidationError } from '@/app/lib/services/chat-service';

import { POST } from '../route';

// Mock ChatService but keep Error classes
vi.mock('@/app/lib/services/chat-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/services/chat-service')>();
  return {
    ...actual,
    ChatService: vi.fn(),
  };
});
vi.mock('@/app/config/env', () => ({
  env: { NODE_ENV: 'development' },
}));

// Mock Request
const createRequest = (body: unknown, headers: Record<string, string> = {}) => {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '127.0.0.1', // Mock IP
      ...headers,
    },
    body: JSON.stringify(body),
  });
};

describe('Route Handler: POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: 'invalid-json',
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid JSON');
  });

  it('should return 400 for ValidationError', async () => {
    // ChatService.prototype.processMessage mockup
    // We mocked the class, so we need to access the mock checking instance logic?
    // Actually vi.mock auto-mocks the class constructor and methods.

    // Setup generic mock for processMessage rejection
    const mockProcessMessage = vi
      .fn()
      .mockRejectedValue(new ValidationError([{ code: 'custom_error' }]));

    // We need to make sure the POST handler uses OUR mock.
    // 'new ChatService()' inside POST returns an instance of the mocked class.

    // @ts-expect-error - Mocking class implementation
    ChatService.mockImplementation(() => ({
      processMessage: mockProcessMessage,
    }));

    const req = createRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Petición inválida');
    expect(data.details).toEqual([{ code: 'custom_error' }]);
  });

  it('should return 429 for RateLimitError', async () => {
    const mockProcessMessage = vi.fn().mockRejectedValue(new RateLimitError(60));
    // @ts-expect-error - Mocking class implementation
    ChatService.mockImplementation(() => ({
      processMessage: mockProcessMessage,
    }));

    const req = createRequest({ messages: [] });
    const response = await POST(req);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('should return 200 and stream on success', async () => {
    const mockStreamResponse = new Response('stream data');
    const mockProcessMessage = vi.fn().mockResolvedValue({
      toUIMessageStreamResponse: () => mockStreamResponse,
    });

    // @ts-expect-error - Mocking class implementation
    ChatService.mockImplementation(() => ({
      processMessage: mockProcessMessage,
    }));

    const req = createRequest({ messages: [] });
    const response = await POST(req);

    expect(response).toBe(mockStreamResponse);
  });
});
