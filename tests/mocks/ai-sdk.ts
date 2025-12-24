import { vi } from 'vitest';

/**
 * Mock implementation of AI SDK functions.
 * Use this to simulate AI responses in your tests.
 */
export const MockAiSdk = {
  streamText: vi.fn(),
  generateText: vi.fn(),
  tool: vi.fn((def) => def),
};

// Default mock implementation specific to streamText
// Returns a mock stream object that can be iterated asynchronously
export const createMockStream = (content: string) => {
  return {
    toDataStreamResponse: vi.fn(() => new Response(content)),
    active: true,
    text: Promise.resolve(content),
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: content };
    })(),
  };
};
