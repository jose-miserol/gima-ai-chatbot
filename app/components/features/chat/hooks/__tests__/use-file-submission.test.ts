import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as actions from '@/app/actions';
import { useFileSubmission } from '@/app/components/features/chat/hooks/use-file-submission';
import { useToast } from '@/app/components/ui/toast';
import { MAX_PDF_SIZE_BYTES } from '@/app/config/limits';

// Mock dependencies
vi.mock('@/app/actions', () => ({
  analyzePartImage: vi.fn(),
  analyzePdf: vi.fn(),
}));

vi.mock('@/app/components/ui/toast', () => ({
  useToast: vi.fn(),
}));

// Mock fetch for blob handling
global.fetch = vi.fn();
// Mock FileReader
class MockFileReader {
  onloadend: (() => void) | null = null;
  onload: (() => void) | null = null;
  readAsDataURL() {
    this.onloadend?.();
    this.onload?.();
  }
  result = 'data:application/pdf;base64,mockbase64data';
}
 
global.FileReader = MockFileReader as any;

describe('useFileSubmission', () => {
  const mockSetMessages = vi.fn();
  const mockSendMessage = vi.fn();
  const mockToggleListening = vi.fn();
  const mockToast = { success: vi.fn(), error: vi.fn() };

  const defaultProps = {
    setMessages: mockSetMessages,
    sendMessage: mockSendMessage,
    isListening: false,
    toggleListening: mockToggleListening,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
     
    (useToast as any).mockReturnValue(mockToast);
     
    (global.fetch as any).mockResolvedValue({
      blob: () => Promise.resolve({ size: 1024, type: 'application/pdf' }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFileSubmission(defaultProps));
    expect(result.current.isAnalyzing).toBe(false);
    expect(typeof result.current.handleSubmit).toBe('function');
  });

  it('should handle PDF submission correctly', async () => {
     
    (actions.analyzePdf as any).mockResolvedValue({
      success: true,
      text: 'PDF analyzed',
    });

    const { result } = renderHook(() => useFileSubmission(defaultProps));

    const message = {
      text: '',
      files: [
        {
          id: '1',
          url: 'blob:http://localhost/123',
          mediaType: 'application/pdf',
          type: 'text', // AI SDK type
           
        } as any,
      ],
    };

    await act(async () => {
      await result.current.handleSubmit(message);
    });

    expect(actions.analyzePdf).toHaveBeenCalledWith(
      expect.stringContaining('base64'),
      '' // prompt text
    );
    expect(mockSetMessages).toHaveBeenCalledTimes(2); // User message + Assistant message
    expect(mockToast.success).toHaveBeenCalledWith('PDF analizado', expect.any(String));
  });

  it('should validate PDF size limit', async () => {
    // Mock large file
     
    (global.fetch as any).mockResolvedValue({
      blob: () => Promise.resolve({ size: MAX_PDF_SIZE_BYTES + 1, type: 'application/pdf' }),
    });

    const { result } = renderHook(() => useFileSubmission(defaultProps));

    const message = {
      text: '',
      files: [
        {
          id: '1',
          url: 'blob:http://localhost/large',
          mediaType: 'application/pdf',
          type: 'text',
           
        } as any,
      ],
    };

    await act(async () => {
      await result.current.handleSubmit(message);
    });

    expect(mockToast.error).toHaveBeenCalledWith(
      'Error al procesar PDF',
      expect.stringContaining('excede el límite')
    );
    expect(actions.analyzePdf).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
     
    (actions.analyzePdf as any).mockResolvedValue({
      success: false,
      error: 'API Error',
    });

    const { result } = renderHook(() => useFileSubmission(defaultProps));

    const message = {
      text: '',
      files: [
        {
          id: '1',
          url: 'blob:http://localhost/error',
          mediaType: 'application/pdf',
          type: 'text',
           
        } as any,
      ],
    };

    await act(async () => {
      await result.current.handleSubmit(message);
    });

    expect(mockToast.error).toHaveBeenCalledWith('Error de análisis', 'API Error');
    // Should still add error message to chat
    expect(mockSetMessages).toHaveBeenCalledTimes(2);
  });

  it('should fallback to sendMessage for non-file messages', async () => {
    const { result } = renderHook(() => useFileSubmission(defaultProps));

    const message = {
      text: 'Hello world',
      files: [],
    };

    await act(async () => {
      await result.current.handleSubmit(message);
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello world' }),
      expect.any(Object)
    );
    expect(actions.analyzePdf).not.toHaveBeenCalled();
    expect(actions.analyzePartImage).not.toHaveBeenCalled();
  });

  it('should stop listening if voice is active', async () => {
    const props = { ...defaultProps, isListening: true };
    const { result } = renderHook(() => useFileSubmission(props));

    const message = {
      text: 'test',
      files: [],
    };

    await act(async () => {
      await result.current.handleSubmit(message);
    });

    expect(mockToggleListening).toHaveBeenCalled();
  });
});
