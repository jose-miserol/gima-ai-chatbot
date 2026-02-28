import { describe, it, expect, vi, beforeEach } from 'vitest';

import { generateObject } from 'ai';
import { MAX_IMAGE_SIZE_MB } from '@/app/config/limits';

import { analyzePartImage } from '../vision';

// Mock dependencies
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(),
}));

describe('Server Action: Vision (analyzePartImage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createFormData = (file: File | null, prompt?: string) => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (prompt) formData.append('prompt', prompt);
    return formData;
  };

  it('should throw error if image input is empty', async () => {
    const formData = createFormData(null);
    const result = await analyzePartImage(formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Imagen vacía');
  });

  it('should fail if image size exceeds MAX_IMAGE_SIZE_MB', async () => {
    const hugeBuffer = new ArrayBuffer(MAX_IMAGE_SIZE_MB * 1.5 * 1024 * 1024);
    const largeFile = new File([hugeBuffer], 'large.jpg', { type: 'image/jpeg' });
    const formData = createFormData(largeFile);

    const result = await analyzePartImage(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Imagen demasiado grande');
  });

  it('should call generateObject with correct parameters on success', async () => {
    const mockRepuesto = {
      tipo_articulo: 'equipo',
      descripcion: 'Bomba de agua centrífuga genérica.',
      cantidad_detectada: 1,
      estado_fisico: 'usado',
      recomendacion: 'Prueba de recomendación.',
      nivel_confianza: 'alta',
    };

    (generateObject as any).mockResolvedValue({ object: mockRepuesto });

    const validBuffer = new ArrayBuffer(1024);
    const validFile = new File([validBuffer], 'test.jpg', { type: 'image/jpeg' });
    const formData = createFormData(validFile, 'Custom Prompt');

    const result = await analyzePartImage(formData);

    expect(result.success).toBe(true);
    expect(result.result).toEqual(mockRepuesto);

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Custom Prompt' }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    (generateObject as any).mockRejectedValue(new Error('Google API Error'));

    const validBuffer = new ArrayBuffer(1024);
    const validFile = new File([validBuffer], 'test.jpg', { type: 'image/jpeg' });
    const formData = createFormData(validFile);

    const result = await analyzePartImage(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google API Error');
  });
});
