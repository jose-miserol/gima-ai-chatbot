import { useCallback } from 'react';

import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';

import { CHAT_CONFIG } from '../constants';

interface FileAttachment {
  url?: string;
  mediaType?: string;
  name?: string;
}

interface SendMessageOptions {
  body?: {
    model?: string;
  };
}

interface UseChatSubmitParams {
  sendMessage: (message: { text: string; files?: FileAttachment[] }, options?: SendMessageOptions) => void;
  isListening: boolean;
  toggleListening: () => void;
  model: string;
  setInput: (value: string) => void;
  analyzeImage: (imageFile: FileAttachment) => Promise<boolean>;
  setIsAnalyzingImage: (value: boolean) => void;
}

/**
 * useChatSubmit - Hook para gestión de envío de mensajes del chat
 *
 * Maneja la lógica completa de envío de mensajes incluyendo:
 * - Validación: Verifica que haya texto o archivos antes de enviar
 * - Control de voz: Detiene grabación si está activa al enviar
 * - Detección de imágenes: Identifica imágenes adjuntas automáticamente
 * - Análisis automático: Si imagen con menos de 10 caracteres de texto, delega a Gemini Vision
 *
 * @param params - Parámetros del hook
 * @param params.sendMessage - Función para enviar mensaje a la API
 * @param params.isListening - Estado de grabación de voz
 * @param params.toggleListening - Toggle grabación de voz
 * @param params.model - Modelo de AI a usar
 * @param params.setInput - Setter para limpiar input
 * @param params.analyzeImage - Función para analizar imagen con Gemini
 * @param params.setIsAnalyzingImage - Setter para estado de análisis
 * @returns Objeto con función handleSubmit
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
