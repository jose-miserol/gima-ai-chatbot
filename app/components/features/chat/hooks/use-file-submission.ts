'use client';

import { useCallback, useState } from 'react';

import { analyzePartImage, analyzePdf } from '@/app/actions';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';
import { useToast } from '@/app/components/ui/toast';
import { DEFAULT_MODEL } from '@/app/config';
import { MAX_IMAGE_SIZE_BYTES, MAX_PDF_SIZE_BYTES, bytesToMB } from '@/app/config/limits';

import type { MessagePart } from '../types';
import type { UIMessage, ChatRequestOptions } from 'ai';

/**
 * Parámetros para el hook useFileSubmission
 */
export interface UseFileSubmissionParams {
  /** Función para actualizar el array de mensajes */
  setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
  /** Función para enviar mensajes regulares (sin archivos) */
  sendMessage: (
    message: { role: 'user'; content: string } | string,
    options?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  /** Si el modo de voz está escuchando activamente */
  isListening: boolean;
  /** Función para alternar el estado de escucha de voz */
  toggleListening: () => void;
}

/**
 * Tipo de retorno para el hook useFileSubmission
 */
export interface UseFileSubmissionReturn {
  /** Manejador de envío para mensajes con posibles adjuntos */
  handleSubmit: (message: PromptInputMessage) => Promise<void>;
  /** Si se está analizando un archivo actualmente */
  isAnalyzing: boolean;
  /** Tipo de archivo que se está analizando */
  analyzingFileType: 'image' | 'pdf' | null;
}

/**
 * useFileSubmission - Hook personalizado para manejo de análisis de archivos en chat
 * Soporta Imágenes y PDFs
 *
 * Extrae toda la lógica de procesamiento de archivos del componente Chat:
 * - Detecta adjuntos de imágenes y PDF
 * - Valida tamaños de archivo
 * - Convierte URLs blob a base64
 * - Llama a las server actions apropiadas (Gemini Vision o análisis PDF)
 * - Gestiona estado de análisis e indicadores de carga
 * @param params - Parámetros del hook
 */
export function useFileSubmission({
  setMessages,
  sendMessage,
  isListening,
  toggleListening,
}: UseFileSubmissionParams): UseFileSubmissionReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingFileType, setAnalyzingFileType] = useState<'image' | 'pdf' | null>(null);
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
        setAnalyzingFileType(isPdf ? 'pdf' : 'image');
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
                isPdf
                  ? {
                      type: 'file',
                      data: fileDataUrl,
                      mediaType: targetFile.mediaType,
                    }
                  : {
                      type: 'image',
                      imageUrl: fileDataUrl,
                      mimeType: targetFile.mediaType,
                    },
              ],
              createdAt: new Date(),
            } as UIMessage,
          ]);

          // Call specific server action based on type
          let result: any;
          const formData = new FormData();
          const fileName =
            'name' in targetFile && typeof targetFile.name === 'string'
              ? targetFile.name
              : 'archivo';
          formData.append('file', blob, fileName);
          if (message.text?.trim()) {
            formData.append('prompt', message.text.trim());
          }

          if (isPdf) {
            result = await analyzePdf(formData);
          } else {
            result = await analyzePartImage(formData);
          }

          if (isPdf && result.success && result.text) {
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
          } else if (!isPdf && result.success && result.result) {
            const visionId = `analysis-${Date.now()}`;
            const analysisObj = result.result;
            const formattedText = `📷 **Análisis Visual (IA)**
          
**Tipo:** ${analysisObj.tipo_articulo}
**Estado:** ${analysisObj.estado_fisico.replace('_', ' ')}
**Confianza:** ${analysisObj.nivel_confianza}

${analysisObj.descripcion}

- **Cant. detectada:** ${analysisObj.cantidad_detectada}
- **Marca:** ${analysisObj.marca || 'N/A'}
- **Modelo:** ${analysisObj.modelo || 'N/A'}

💡 **Recomendación:** ${analysisObj.recomendacion}
---
*Generado automáticamente a partir de la imagen.*`;

            setMessages((prev: UIMessage[]) => [
              ...prev,
              {
                id: visionId,
                role: 'assistant',
                content: formattedText,
                parts: [{ type: 'text', text: formattedText }] as unknown as MessagePart[],
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
          setAnalyzingFileType(null);
        }

        return;
      }

      // Normal text message (no recognized file for analysis) - use GROQ
      // Manually add user message to state first (AI SDK doesn't do this automatically with custom persistence)
      const userMessageId = `user-${Date.now()}`;
      const userText = message.text || 'Mensaje';

      setMessages((prev: UIMessage[]) => [
        ...prev,
        {
          id: userMessageId,
          role: 'user',
          content: userText,
          parts: [{ type: 'text', text: userText }],
          createdAt: new Date(),
        } as UIMessage,
      ]);

      await sendMessage(
        {
          role: 'user',
          content: userText,
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

  return { handleSubmit, isAnalyzing, analyzingFileType };
}
