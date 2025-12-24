/**
 * Performance Tests - Chat Processing Benchmarks
 *
 * Este módulo contiene benchmarks para verificar que las operaciones
 * críticas del chat se ejecutan dentro de los límites de tiempo aceptables.
 *
 * Targets:
 * - Sanitización de mensajes: <10ms/1000 mensajes
 * - Serialización localStorage: <5ms
 */

import { describe, it, expect } from 'vitest';
import { sanitizeForModel } from '@/app/components/features/chat/utils';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

// ===========================================
// Test Data Generators
// ===========================================

/**
 * Genera un array de mensajes de prueba
 */
function generateTestMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: 'user' as const,
    content: `Test message number ${i} with some additional content to simulate real messages`,
    parts: [],
    createdAt: new Date(),
  }));
}

/**
 * Genera un historial de chat para serialización
 */
function generateChatHistory(messageCount: number) {
  return {
    messages: generateTestMessages(messageCount),
    createdAt: Date.now(),
    title: 'Test Chat',
  };
}

// ===========================================
// Performance Tests
// ===========================================

describe('Performance: Chat Operations', () => {
  describe('Message Sanitization', () => {
    it('should sanitize 100 messages in <5ms', () => {
      const messages = generateTestMessages(100);

      const start = performance.now();
      sanitizeForModel(messages);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should sanitize 1000 messages in <10ms', () => {
      const messages = generateTestMessages(1000);

      const start = performance.now();
      sanitizeForModel(messages);
      const duration = performance.now() - start;

      console.log(`Sanitization of 1000 messages: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('localStorage Serialization', () => {
    it('should compress chat history in <5ms', () => {
      const history = generateChatHistory(100);
      const jsonString = JSON.stringify(history);

      const start = performance.now();
      const compressed = compressToUTF16(jsonString);
      const duration = performance.now() - start;

      console.log(`Compression of 100 messages: ${duration.toFixed(2)}ms`);
      console.log(`Original size: ${jsonString.length}, Compressed: ${compressed.length}`);

      expect(duration).toBeLessThan(5);
    });

    it('should decompress chat history in <5ms', () => {
      const history = generateChatHistory(100);
      const jsonString = JSON.stringify(history);
      const compressed = compressToUTF16(jsonString);

      const start = performance.now();
      const decompressed = decompressFromUTF16(compressed);
      const duration = performance.now() - start;

      console.log(`Decompression: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(5);
      expect(decompressed).toBe(jsonString);
    });
  });

  describe('Large Data Handling', () => {
    it('should handle 5000 messages without timeout', () => {
      const messages = generateTestMessages(5000);

      const start = performance.now();
      const sanitized = sanitizeForModel(messages);
      const duration = performance.now() - start;

      console.log(`5000 messages sanitization: ${duration.toFixed(2)}ms`);

      expect(sanitized.length).toBeLessThanOrEqual(5000);
      expect(duration).toBeLessThan(100); // Generous limit for large datasets
    });
  });
});
