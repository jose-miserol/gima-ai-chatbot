import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzePartImage } from '../vision';
import { MockAiSdk } from '@/tests/mocks/ai-sdk';
import { MAX_IMAGE_SIZE_MB } from '@/app/config/limits';

// Mock dependencies
vi.mock('ai', () => ({
  generateText: (args: any) => MockAiSdk.generateText(args),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(),
}));

describe('Server Action: Vision (analyzePartImage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Small fake base64
  const smallBase64 =
    'data:image/jpeg;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  it('should throw error/fail if image input is empty', async () => {
    const result = await analyzePartImage('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Imagen vacía');
  });

  it('should fail if image size exceeds MAX_IMAGE_SIZE_MB', async () => {
    // Create a large fake base64 string to simulate size
    // 1MB ~ 1.33MB base64. Let's make a huge string.
    const hugeString = 'a'.repeat(MAX_IMAGE_SIZE_MB * 1.5 * 1024 * 1024);
    const result = await analyzePartImage(`data:image/jpeg;base64,${hugeString}`);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Imagen demasiado grande');
  });

  it('should call generateText with correct parameters on success', async () => {
    MockAiSdk.generateText.mockResolvedValue({ text: 'Descripción detectada' });

    const result = await analyzePartImage(smallBase64, 'image/png', 'Custom Prompt');

    expect(result.success).toBe(true);
    expect(result.text).toBe('Descripción detectada');

    expect(MockAiSdk.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Custom Prompt' }),
              expect.objectContaining({
                type: 'file',
                mediaType: 'image/png',
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    MockAiSdk.generateText.mockRejectedValue(new Error('API Error'));

    const result = await analyzePartImage(smallBase64);

    expect(result.success).toBe(false);
    expect(result.error).toBe('API Error');
  });
});
