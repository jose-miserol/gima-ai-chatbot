import { describe, it, expect, vi } from 'vitest';
import { transformData } from '../data-transformation';
import { transformationActionSchema } from '@/app/lib/schemas/data-transformation.schema';

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      success: true,
      data: { transformed: true },
      summary: 'Test transformation',
      stats: { additions: 1, deletions: 0 },
    },
  }),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(),
}));

vi.mock('@/app/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Data Transformation Action', () => {
  it('should validate inputs correctly', async () => {
    // Caso inválido (data vacía)
    const result = await transformData({
      sourceData: '',
      instruction: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('requeridos');
  });

  it('should process valid request successfully', async () => {
    const result = await transformData({
      sourceData: 'test data',
      instruction: 'transform this',
      format: 'text',
    });

    expect(result.success).toBe(true);
    expect((result as any).data).toEqual({ transformed: true });
  });

  it('should handle schema validation logic separate from action', () => {
    const invalid = transformationActionSchema.safeParse({ sourceData: '' });
    expect(invalid.success).toBe(false);

    const valid = transformationActionSchema.safeParse({
      sourceData: 'valid',
      instruction: 'instruction',
    });
    expect(valid.success).toBe(true);
  });
});
