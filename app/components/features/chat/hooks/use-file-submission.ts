'use client';

import { useCallback, useState } from 'react';
import type { UIMessage, ChatRequestOptions } from 'ai';
import { analyzePartImage, analyzePdf } from '@/app/actions';
import { useToast } from '@/app/components/ui/toast';
import { DEFAULT_MODEL } from '@/app/config';
import { MAX_IMAGE_SIZE_BYTES, MAX_PDF_SIZE_BYTES, bytesToMB } from '@/app/config/limits';
import type { MessagePart } from '../types';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';

/**
 * Parameters for useFileSubmission hook
 */
export interface UseFileSubmissionParams {
  /** Function to update messages array */
  setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
  /** Function to send regular (non-file) messages */
  sendMessage: (message: any, options?: ChatRequestOptions) => Promise<string | null | undefined>;
  /** Whether voice is currently listening */
  isListening: boolean;
  /** Function to toggle voice listening */
  toggleListening: () => void;
}

/**
 * Return type for useFileSubmission hook
 */
export interface UseFileSubmissionReturn {
  /** Submit handler for messages with potential file attachments */
  handleSubmit: (message: PromptInputMessage) => Promise<void>;
  /** Whether a file is currently being analyzed */
  isAnalyzing: boolean;
}

/**
 * useFileSubmission - Custom hook for handling file analysis in chat
 * Supports Images and PDFs
 *
 * Extracts all file processing logic from the Chat component:
 * - Detects image and PDF attachments
 * - Validates file sizes
 * - Converts blob URLs to base64
 * - Calls appropriate server actions (Gemini Vision or PDF analysis)
 * - Manages analysis state and loading indicators
 */
export function useFileSubmission({
  setMessages,
  sendMessage,
  isListening,
  toggleListening,
}: UseFileSubmissionParams): UseFileSubmissionReturn {
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

      // Check for supported files
      const imageFile = message.files?.find((file) => file.mediaType?.startsWith('image/'));
      const pdfFile = message.files?.find((file) => file.mediaType === 'application/pdf');
      const targetFile = imageFile || pdfFile;

      // Logic for file analysis (Image or PDF)
      if (targetFile && targetFile.url) {
        setIsAnalyzing(true);
        const isPdf = targetFile.mediaType === 'application/pdf';
        const fileTypeLabel = isPdf ? 'PDF' : 'Imagen'; // Fix: Capitalize correctly

        try {
          // Fetch blob URL and convert to base64
          const response = await fetch(targetFile.url);
          const blob = await response.blob();
          const fileSize = blob.size;

          // Check limits
          const limitBytes = isPdf ? MAX_PDF_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
          if (fileSize > limitBytes) {
            throw new Error(`El archivo excede el límite de ${bytesToMB(limitBytes)}MB`);
          }

          const base64Promise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const fileDataUrl = await base64Promise;

          // Add user message with the file attachment
          const userMessageId = `user-${Date.now()}`;
          const userText = message.text?.trim() || `Analizar este ${fileTypeLabel}`;

          setMessages((prev: UIMessage[]) => [
            ...prev,
            {
              id: userMessageId,
              role: 'user',
              content: userText,
              parts: [
                { type: 'text', text: userText },
                {
                  type: 'file', // Generic file type, UI handles rendering based on mimeType
                  data: fileDataUrl, // Store dataUrl for local preview continuity if needed
                  mimeType: targetFile.mediaType,
                },
              ],
              createdAt: new Date(),
            } as UIMessage,
          ]);

          // Call specific server action based on type
          let result;
          if (isPdf) {
            result = await analyzePdf(fileDataUrl, message.text?.trim());
          } else {
            result = await analyzePartImage(
              fileDataUrl,
              targetFile.mediaType || 'image/jpeg',
              message.text?.trim()
            );
          }

          if (result.success && result.text) {
            const analysisId = `analysis-${Date.now()}`;

            // Add analysis result to chat
            setMessages((prev: UIMessage[]) => [
              ...prev,
              {
                id: analysisId,
                role: 'assistant',
                content: result.text,
                parts: [{ type: 'text', text: result.text }] as unknown as MessagePart[],
                createdAt: new Date(),
              } as UIMessage,
            ]);

            toast.success(`${fileTypeLabel} analizado`, 'El análisis se ha agregado al chat');
          } else {
            const errorMsg = `❌ Error al analizar ${fileTypeLabel}: ${result.error || 'Error desconocido'}`;
            // Add error message to chat
            setMessages((prev: UIMessage[]) => [
              ...prev,
              {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: errorMsg,
                parts: [{ type: 'text', text: errorMsg }],
                createdAt: new Date(),
              } as UIMessage,
            ]);

            toast.error(
              'Error de análisis',
              result.error || `No se pudo analizar el ${fileTypeLabel}`
            );
          }
        } catch (error: unknown) {
          console.error(`Error processing ${fileTypeLabel}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          const errorMsg = `❌ Error al procesar ${fileTypeLabel}: ${errorMessage}`;

          setMessages((prev: UIMessage[]) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: errorMsg,
              parts: [{ type: 'text', text: errorMsg }],
              createdAt: new Date(),
            } as UIMessage,
          ]);

          toast.error(`Error al procesar ${fileTypeLabel}`, errorMessage);
        } finally {
          setIsAnalyzing(false);
        }

        return;
      }

      // Normal text message (no recognized file for analysis) - use GROQ
      await sendMessage(
        {
          role: 'user',
          content: message.text || 'Mensaje',
          // files: message.files, // CreateMessage doesn't support files directly in this way usually, check type
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
