import { useCallback } from 'react';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';
import { CHAT_CONFIG } from '@/app/config/chat';

interface FileAttachment {
  url?: string;
  mediaType?: string;
  name?: string;
}

interface UseChatSubmitParams {
  sendMessage: (message: { text: string; files?: FileAttachment[] }, options?: any) => void;
  isListening: boolean;
  toggleListening: () => void;
  model: string;
  setInput: (value: string) => void;
  analyzeImage: (imageFile: FileAttachment) => Promise<boolean>;
  setIsAnalyzingImage: (value: boolean) => void;
}

/**
 * Custom hook for handling chat message submission
 *
 * Manages the complete flow of submitting messages:
 * - Input validation
 * - Voice control
 * - Image detection and analysis delegation
 * - Normal text message sending
 *
 * @returns handleSubmit function
 */
export function useChatSubmit({
  sendMessage,
  isListening,
  toggleListening,
  model,
  setInput,
  analyzeImage,
  setIsAnalyzingImage,
}: UseChatSubmitParams) {
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      // Stop listening if voice is active
      if (isListening) {
        toggleListening();
      }

      // Check if there's an image attachment for auto-inventory analysis
      const imageFile = message.files?.find((file) => file.mediaType?.startsWith('image/'));

      // If image attached with minimal/no text, use Gemini for vision analysis
      if (
        imageFile &&
        imageFile.url &&
        (!hasText || (message.text?.trim().length || 0) < CHAT_CONFIG.MIN_TEXT_LENGTH_FOR_IMAGE)
      ) {
        setIsAnalyzingImage(true);
        await analyzeImage(imageFile);
        setIsAnalyzingImage(false);
        setInput('');
        return;
      }

      // Normal text message - use GROQ
      sendMessage(
        {
          text: message.text || 'Archivo adjunto',
          files: message.files,
        },
        {
          body: {
            model: model,
          },
        }
      );

      setInput('');
    },
    [isListening, toggleListening, model, setInput, analyzeImage, setIsAnalyzingImage, sendMessage]
  );

  return { handleSubmit };
}
