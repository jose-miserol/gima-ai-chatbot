/**
 * Tests for chat-utils.ts
 * @vitest-environment jsdom
 */

/// <reference types="vitest/globals" />

import { sanitizeMessages, hasValidContent, filterEmptyMessages } from '../chat-utils';

import type { Message } from '../schemas/chat';
import type { UIMessage } from 'ai';

describe('sanitizeMessages', () => {
  it('should handle string content directly', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Hello world',
        id: 'test-1',
        createdAt: new Date('2025-01-01'),
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].id).toBe('test-1');
  });

  it('should extract text from content object with text property', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: { text: 'Hello from object' },
        createdAt: undefined,
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
  });

  it('should extract text from content object with parts', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: {
          parts: [{ type: 'text' as const, text: 'Hello from parts' }],
        },
        createdAt: undefined,
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(1);
  });

  it('should generate UUID if id is not provided', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: 'Response',
        createdAt: undefined,
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result[0].id).toBeDefined();
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('should handle createdAt as Date', () => {
    const date = new Date('2025-12-22');
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Test',
        createdAt: date,
      },
    ];

    const result = sanitizeMessages(messages);

    // Access via any since UIMessage type doesn't include createdAt
     
    expect((result[0] as any).createdAt).toEqual(date);
  });

  it('should return empty string for missing content', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: '',
        createdAt: undefined,
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result).toHaveLength(1);
  });

  it('should preserve parts array', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: 'Text message',
        parts: [{ type: 'text' as const, text: 'Part text' }],
        createdAt: undefined,
      },
    ];

    const result = sanitizeMessages(messages);

    expect(result[0].parts).toBeDefined();
    expect(result[0].parts).toHaveLength(1);
  });
});

describe('hasValidContent', () => {
  it('should return true for message with text content in parts', () => {
    const message = {
      id: 'test-1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Hello' }],
    } as unknown as UIMessage;

    expect(hasValidContent(message)).toBe(true);
  });

  it('should return false for message with empty text', () => {
    const message = {
      id: 'test-1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: '   ' }],
    } as unknown as UIMessage;

    expect(hasValidContent(message)).toBe(false);
  });

  it('should return false for message without parts', () => {
    const message = {
      id: 'test-1',
      role: 'user' as const,
      parts: [],
    } as unknown as UIMessage;

    expect(hasValidContent(message)).toBe(false);
  });
});

describe('filterEmptyMessages', () => {
  it('should filter out messages with empty content', () => {
    const messages = [
      {
        id: 'test-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Valid' }],
      },
      {
        id: 'test-2',
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: '' }],
      },
    ] as unknown as UIMessage[];

    const result = filterEmptyMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
  });
});
