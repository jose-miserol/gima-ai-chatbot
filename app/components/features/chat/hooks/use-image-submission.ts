'use client';

import { useCallback, useState } from 'react';
import { analyzePartImage } from '@/app/actions';
import { useToast } from '@/app/components/ui/toast';
import { DEFAULT_MODEL } from '@/app/config';
import type { MessagePart } from '../types';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';

/**
 * Parameters for useImageSubmission hook
 */
export interface UseImageSubmissionParams {
  /** Function to update messages array */
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  /** Function to send regular (non-image) messages */
  sendMessage: (message: any, options?: any) => void;
  /** Whether voice is currently listening */
  isListening: boolean;
  /** Function to toggle voice listening */
  toggleListening: () => void;
}

/**
 * Return type for useImageSubmission hook
 */
export interface UseImageSubmissionReturn {
  /** Submit handler for messages with potential image attachments */
  handleSubmit: (message: PromptInputMessage) => Promise<void>;
  /** Whether an image is currently being analyzed */
  isAnalyzing: boolean;
}

/**
 * useImageSubmission - Custom hook for handling image analysis in chat
 *
 * Extracts all image processing logic from the Chat component:
 * - Detects image attachments in messages
 * - Converts blob URLs to base64 for API submission
 * - Calls Gemini Vision API for image analysis
 * - Manages analysis state and loading indicators
 * - Handles success/error states with toast notifications
 * - Falls back to regular message sending for non-image messages
 *
 * Flow:
 * 1. Check if message has text or attachments
 * 2. Stop voice listening if active
 * 3. Detect image files in attachments
 * 4. If image found:
 *    - Convert blob URL to base64
 *    - Add user message with image to chat
 *    - Call Gemini Vision API
 *    - Add analysis result to chat
 *    - Show success/error toast
 * 5. If no image:
 *    - Send normal text message via GROQ
 *
 * @param params - Configuration object with message handlers and voice state
 * @returns Object with handleSubmit function and isAnalyzing state
 *
 * @example
 * ```tsx
 * const { handleSubmit, isAnalyzing } = useImageSubmission({
 *   setMessages,
 *   sendMessage,
 *   isListening,
 *   toggleListening
 * });
 *
 * // In your component
 * <ChatInputArea onSubmit={handleSubmit} isAnalyzingImage={isAnalyzing} />
 * ```
 */
export function useImageSubmission({
  setMessages,
  sendMessage,
  isListening,
  toggleListening,
}: UseImageSubmissionParams): UseImageSubmissionReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const toast = useToast();

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

      // Check if there's an image attachment for auto-analysis
      const imageFile = message.files?.find((file) => file.mediaType?.startsWith('image/'));

      // If image attached, always use Gemini for vision analysis (with custom prompt or default)
      if (imageFile && imageFile.url) {
        setIsAnalyzing(true);

        try {
          // Fetch blob URL and convert to base64
          const response = await fetch(imageFile.url);
          const blob = await response.blob();

          const base64Promise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const imageDataUrl = await base64Promise;

          // Add user message with the image attachment
          const userMessageId = `user-${Date.now()}`;
          const userText = message.text?.trim() || 'Analizar esta imagen';

          setMessages(
            (prev) =>
              [
                ...prev,
                {
                  id: userMessageId,
                  role: 'user',
                  content: userText,
                  parts: [
                    { type: 'text', text: userText },
                    {
                      type: 'image',
                      imageUrl: imageFile.url,
                      mimeType: imageFile.mediaType || 'image/jpeg',
                    },
                  ] as MessagePart[],
                  createdAt: new Date(),
                },
              ] as any
          );

          // Call Gemini vision via server action with custom prompt (or default)
          const result = await analyzePartImage(
            imageDataUrl,
            imageFile.mediaType || 'image/jpeg',
            message.text?.trim() // Pass user's text as custom prompt
          );

          if (result.success && result.text) {
            const visionId = `vision-${Date.now()}`;

            // Agregar mensaje de análisis al chat con imagen incluida
            setMessages(
              (prev) =>
                [
                  ...prev,
                  {
                    id: visionId,
                    role: 'assistant',
                    content: result.text,
                    parts: [
                      { type: 'text', text: result.text },
                      {
                        type: 'image',
                        imageUrl: imageFile.url,
                        mimeType: imageFile.mediaType || 'image/jpeg',
                      },
                    ] as MessagePart[],
                    createdAt: new Date(),
                  },
                ] as any
            );

            toast.success('Imagen analizada', 'El análisis se ha agregado al chat');
          } else {
            const errorMsg = `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`;
            setMessages(
              (prev) =>
                [
                  ...prev,
                  {
                    id: `vision-error-${Date.now()}`,
                    role: 'assistant',
                    content: errorMsg,
                    parts: [{ type: 'text', text: errorMsg }] as MessagePart[],
                    createdAt: new Date(),
                  },
                ] as any
            );
            toast.error('Error de visión', result.error || 'No se pudo analizar la imagen');
          }
        } catch (error: unknown) {
          console.error('Error processing image:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          const errorMsg = `❌ Error al procesar imagen: ${errorMessage}`;
          setMessages(
            (prev) =>
              [
                ...prev,
                {
                  id: `vision-error-${Date.now()}`,
                  role: 'assistant',
                  content: errorMsg,
                  parts: [{ type: 'text', text: errorMsg }] as MessagePart[],
                  createdAt: new Date(),
                },
              ] as any
          );
          toast.error('Error al procesar imagen', errorMessage);
        } finally {
          setIsAnalyzing(false);
        }

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
            model: DEFAULT_MODEL,
          },
        }
      );
    },
    [isListening, toggleListening, setMessages, toast, sendMessage]
  );

  return { handleSubmit, isAnalyzing };
}
