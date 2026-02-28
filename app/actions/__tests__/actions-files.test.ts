import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MAX_PDF_SIZE_MB } from '@/app/config/limits';
import { MockAiSdk } from '@/tests/mocks/ai-sdk';

import { analyzePdf } from '../files';

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

  const createFormData = (file: File | null, prompt?: string) => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (prompt) formData.append('prompt', prompt);
    return formData;
  };

  it('should throw error if PDF input is empty', async () => {
    const formData = createFormData(null);
    const result = await analyzePdf(formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('PDF vacío');
  });

  it('should fail if PDF size exceeds MAX_PDF_SIZE_MB', async () => {
    // Create large dummy file
    const hugeBuffer = new ArrayBuffer(MAX_PDF_SIZE_MB * 1.5 * 1024 * 1024);
    const largeFile = new File([hugeBuffer], 'large.pdf', { type: 'application/pdf' });
    const formData = createFormData(largeFile);

    const result = await analyzePdf(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('PDF demasiado grande');
  });

  it('should call generateText with correct parameters on success', async () => {
    MockAiSdk.generateText.mockResolvedValue({ text: 'PDF Analysis Result' });

    const validBuffer = new ArrayBuffer(1024);
    const validFile = new File([validBuffer], 'test.pdf', { type: 'application/pdf' });
    const formData = createFormData(validFile, 'Summarize this');

    const result = await analyzePdf(formData);

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

    const validBuffer = new ArrayBuffer(1024);
    const validFile = new File([validBuffer], 'test.pdf', { type: 'application/pdf' });
    const formData = createFormData(validFile);

    const result = await analyzePdf(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Google API Error');
  });
});
