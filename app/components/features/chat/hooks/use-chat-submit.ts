import { useCallback } from 'react';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';
import { CHAT_CONFIG } from '../constants';

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
 * useChatSubmit - Hook para gestión de envío de mensajes del chat
 *
 * Maneja la lógica completa de envío de mensajes incluyendo:
 * - Validación: Verifica que haya texto o archivos antes de enviar
 * - Control de voz: Detiene grabación si está activa al enviar
 * - Detección de imágenes: Identifica imágenes adjuntas automáticamente
 * - Análisis automático: Si imagen con menos de 10 caracteres de texto, delega a Gemini Vision
 * - Envío normal: Mensajes de texto van directamente a GROQ
 *
 * Flujo de Decisión:
 * 1. Hay imagen con poco texto (menos de 10 chars)? -> Analizar con Gemini Vision
 * 2. Solo texto o imagen con contexto? -> Enviar a GROQ
 *
 * @param sendMessage - Función para enviar mensaje a la API de chat
 * @param isListening - Estado de grabación de voz (se detiene automáticamente al enviar)
 * @param toggleListening - Función para toggle de grabación de voz
 * @param model - Modelo de AI a usar (GROQ)
 * @param setInput - Setter para limpiar el input después de enviar
 * @param analyzeImage - Función async para analizar imagen con Gemini Vision
 * @param setIsAnalyzingImage - Setter para estado de análisis de imagen
 *
 * @returns Objeto con función handleSubmit para manejar envío
 *
 * @example
 * ```tsx
 * const { handleSubmit } = useChatSubmit({
 *   sendMessage,
 *   isListening,
 *   toggleListening,
 *   model: DEFAULT_MODEL,
 *   setInput,
 *   analyzeImage,
 *  setIsAnalyzingImage
 * });
 *
 * <PromptInput onSubmit={handleSubmit} />
 * ```
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
