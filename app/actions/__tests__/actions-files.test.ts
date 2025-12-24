import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzePdf } from '../files';
import { MockAiSdk } from '@/tests/mocks/ai-sdk';
import { MAX_PDF_SIZE_MB } from '@/app/config/limits';

// Mock dependencies
vi.mock('ai', () => ({
  generateText: (args: any) => MockAiSdk.generateText(args),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(),
}));

describe('Server Action: Files (analyzePdf)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBase64 = 'data:application/pdf;base64,validPdfBase64';

  it('should throw error if PDF input is empty', async () => {
    const result = await analyzePdf('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('PDF vacío');
  });

  it('should fail if PDF size exceeds MAX_PDF_SIZE_MB', async () => {
    // Create large dummy base64
    const hugeString = 'a'.repeat(MAX_PDF_SIZE_MB * 1.5 * 1024 * 1024);
    const result = await analyzePdf(`data:application/pdf;base64,${hugeString}`);

    expect(result.success).toBe(false);
    expect(result.error).toContain('PDF demasiado grande');
  });

  it('should call generateText with correct parameters on success', async () => {
    MockAiSdk.generateText.mockResolvedValue({ text: 'PDF Analysis Result' });

    const result = await analyzePdf(validBase64, 'Summarize this');

    expect(result.success).toBe(true);
    expect(result.text).toBe('PDF Analysis Result');

    expect(MockAiSdk.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Summarize this' }),
              expect.objectContaining({
                type: 'file',
                mediaType: 'application/pdf',
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    MockAiSdk.generateText.mockRejectedValue(new Error('Google API Error'));

    const result = await analyzePdf(validBase64);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google API Error');
  });
});
