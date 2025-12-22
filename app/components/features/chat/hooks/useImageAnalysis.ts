import { useCallback } from 'react';
import { analyzePartImage } from '@/app/actions';

interface FileAttachment {
  url?: string;
  mediaType?: string;
  name?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: Array<{ type: 'text'; text: string }>;
  createdAt: Date;
}

interface ToastFunctions {
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
}

interface UseImageAnalysisParams {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  toast: ToastFunctions;
}

/**
 * Custom hook for handling Gemini Vision image analysis
 *
 * Manages the complete flow of analyzing images with Gemini:
 * - Blob URL to base64 conversion
 * - Server action call
 * - Success/error handling
 * - Message creation with analysis results
 *
 * @param setMessages - Function to update chat messages
 * @param toast - Toast notification system
 * @returns analyzeImage function
 */
export function useImageAnalysis({ setMessages, toast }: UseImageAnalysisParams) {
  const analyzeImage = useCallback(
    async (imageFile: FileAttachment): Promise<boolean> => {
      if (!imageFile.url) return false;

      try {
        // Convert blob URL to base64
        const response = await fetch(imageFile.url);
        const blob = await response.blob();

        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const imageDataUrl = await base64Promise;

        // Call Gemini Vision API via server action
        const result = await analyzePartImage(imageDataUrl, imageFile.mediaType || 'image/jpeg');

        if (result.success && result.text) {
          const visionId = `vision-${Date.now()}`;
          const analysisText = `📷 **Análisis de Imagen Subida por el Usuario**

He analizado la imagen que el usuario acaba de subir. Este es el resultado del análisis visual:

${result.text}

---
*Este análisis fue generado automáticamente a partir de la imagen subida.*`;

          // Add analysis as assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: visionId,
              role: 'assistant',
              content: analysisText,
              parts: [{ type: 'text', text: analysisText }],
              createdAt: new Date(),
            },
          ]);

          toast.success('Imagen analizada', 'El análisis se ha agregado al chat');
          return true;
        } else {
          // Vision failed
          const errorMsg = `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`;
          setMessages((prev) => [
            ...prev,
            {
              id: `vision-error-${Date.now()}`,
              role: 'assistant',
              content: errorMsg,
              parts: [{ type: 'text', text: errorMsg }],
              createdAt: new Date(),
            },
          ]);
          toast.error('Error de visión', result.error || 'No se pudo analizar la imagen');
          return false;
        }
      } catch (error: unknown) {
        console.error('Error processing image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        const errorMsg = `❌ Error al procesar imagen: ${errorMessage}`;

        setMessages((prev) => [
          ...prev,
          {
            id: `vision-error-${Date.now()}`,
            role: 'assistant',
            content: errorMsg,
            parts: [{ type: 'text', text: errorMsg }],
            createdAt: new Date(),
          },
        ]);
        toast.error('Error al procesar imagen', errorMessage);
        return false;
      }
    },
    [setMessages, toast]
  );

  return { analyzeImage };
}
