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
 * useImageAnalysis - Hook para análisis de imágenes con Gemini Vision
 *
 * Gestiona el flujo completo de análisis de imágenes usando Gemini Vision API:
 * - Conversión: Blob URL a Base64 para envío a API
 * - Análisis: Llamada a Gemini Vision vía server action
 * - Resultado exitoso: Agrega análisis como mensaje del asistente en el chat
 * - Manejo de errores: Agrega mensaje de error al chat y muestra toast
 *
 * Flujo de Procesamiento:
 * 1. Fetch blob URL de la imagen
 * 2. Convertir blob a base64 usando FileReader
 * 3. Llamar server action analyzePartImage
 * 4. Si éxito: Agregar análisis formateado como mensaje del asistente
 * 5. Si falla: Agregar mensaje de error al chat
 *
 * Formato del Mensaje de Análisis:
 * ```
 * Análisis de Imagen Subida por el Usuario
 *
 * [Análisis detallado de Gemini]
 *
 * Este análisis fue generado automáticamente...
 * ```
 * @param setMessages - Función para actualizar array de mensajes del chat
 * @param setMessages.setMessages
 * @param toast - Sistema de notificaciones toast (success/error)
 * @param setMessages.toast
 * @returns Objeto con función analyzeImage que retorna Promise<boolean>
 *   - true: Análisis exitoso
 *   - false: Error en análisis
 * @example
 * ```tsx
 * const { analyzeImage } = useImageAnalysis({
 *   setMessages,
 *   toast
 * });
 *
 * const success = await analyzeImage(imageFile);
 * if (success) {
 *   // Análisis agregado al chat
 * }
 * ```
 */
export function useImageAnalysis({ setMessages, toast }: UseImageAnalysisParams) {
  const analyzeImage = useCallback(
    async (imageFile: FileAttachment): Promise<boolean> => {
      if (!imageFile.url) return false;

      try {
        // Convert blob URL to base64
        const response = await fetch(imageFile.url);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, imageFile.name || 'image');

        // Call Gemini Vision API via server action
        const result = await analyzePartImage(formData);

        if (result.success && result.result) {
          const visionId = `vision-${Date.now()}`;
          const formattedText = `📷 **Análisis Visual (IA)**
          
**Tipo:** ${result.result.tipo_articulo}
**Estado:** ${result.result.estado_fisico.replace('_', ' ')}
**Confianza:** ${result.result.nivel_confianza}

${result.result.descripcion}

- **Cant. detectada:** ${result.result.cantidad_detectada}
- **Marca:** ${result.result.marca || 'N/A'}
- **Modelo:** ${result.result.modelo || 'N/A'}

💡 **Recomendación:** ${result.result.recomendacion}
---
*Generado automáticamente a partir de la imagen.*`;

          // Add analysis as assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: visionId,
              role: 'assistant',
              content: formattedText,
              parts: [], // Array vacío - compatible con AI SDK
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
              parts: [], // Array vacío - compatible con AI SDK
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
            parts: [], // Array vacío - compatible con AI SDK
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
