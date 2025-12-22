'use client';

import { useState, useCallback, useRef } from 'react';
import { usePersistentChat } from '@/app/hooks/use-persistent-chat';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { useToast } from '@/app/components/ui/toast';
import { DEFAULT_MODEL } from '@/app/config';
import { analyzePartImage } from '@/app/actions';
import { ConfirmDialog } from '@/app/components/shared/ConfirmDialog';
import { ChatHeader } from './chat-header';
import { ChatConversation } from './chat-conversation';
import { ChatStatusIndicators } from './chat-status-bar';
import { ChatInputArea } from './chat-input-area';
import { CHAT_MESSAGES, CHAT_CONFIG } from './constants';
import { useChatActions } from './hooks/use-chat-actions';
import { useChatKeyboard } from './hooks/use-chat-keyboard';
import type { PromptInputMessage } from '@/app/components/ai-elements/prompt-input';

/**
 * Chat - Componente principal del sistema de chat inteligente de GIMA
 *
 * Orquesta la interfaz completa de chat con capacidades multi-modales:
 * - Mensajería de texto: Conversación con AI usando GROQ
 * - Input de voz: Transcripción usando Gemini AI o Web Speech API nativa
 * - Análisis de imágenes: Detección automática y análisis con Gemini Vision
 * - Historial persistente: Almacenamiento local de conversaciones
 * - Keyboard shortcuts: Atajos para mejorar productividad
 *
 * Características Principales:
 * - Detección automática de imágenes con análisis de visión si no hay texto suficiente
 * - Integración dual de reconocimiento de voz (Gemini AI + fallback nativo)
 * - Gestión de estado de conversación con persistencia en localStorage
 * - Indicadores visuales de estado (grabando, procesando, analizando)
 * - Tema claro/oscuro con ThemeToggle
 * - Confirmación antes de borrar historial
 *
 * Flujo de Análisis de Imagen:
 * 1. Usuario adjunta imagen con menos de 10 caracteres de texto
 * 2. Automáticamente se analiza con Gemini Vision
 * 3. Resultado se agrega como mensaje del asistente
 * 4. Usuario puede continuar conversación con contexto de la imagen
 *
 * Integraciones:
 * - usePersistentChat: Gestión de mensajes y persistencia
 * - useVoiceInput: Transcripción de voz (Gemini/Native)
 * - useChatKeyboard: Atajos de teclado
 * - useChatActions: Acciones (regenerate, clear, copy)
 *
 * @example
 * ```tsx
 * // Uso en page.tsx
 * <Chat />
 * ```
 */
export function Chat() {
  // Estado local
  const [input, setInput] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Integraciones
  const toast = useToast();
  const {
    messages,
    sendMessage,
    status,
    regenerate,
    error: chatError,
    clearHistory,
    setMessages,
  } = usePersistentChat({ storageKey: 'gima-chat-v1' });

  // Voice input
  const updateTextareaValue = useCallback((value: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(textarea, value);
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
    }
    setInput(value);
  }, []);

  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({ onTranscript: updateTextareaValue });

  // Chat actions
  const { handleRegenerate, handleClear, handleCopyMessage } = useChatActions({
    regenerate,
    clearHistory,
    setInput,
  });

  // Computed values
  const canSend =
    status === 'ready' || status === 'error' || (status !== 'streaming' && status !== 'submitted');

  // Handle message submission with image analysis
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

      // If image attached with minimal/no text, use Gemini for vision analysis
      if (
        imageFile &&
        imageFile.url &&
        (!hasText || (message.text?.trim().length || 0) < CHAT_CONFIG.MIN_TEXT_LENGTH_FOR_IMAGE)
      ) {
        setIsAnalyzingImage(true);

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

          // Call Gemini vision via server action
          const result = await analyzePartImage(imageDataUrl, imageFile.mediaType || 'image/jpeg');

          if (result.success && result.text) {
            const visionId = `vision-${Date.now()}`;
            const analysisText = `📷 **Análisis de Imagen Subida por el Usuario**

He analizado la imagen que el usuario acaba de subir. Este es el resultado del análisis visual:

${result.text}

---
*Este análisis fue generado automáticamente a partir de la imagen subida.*`;

            // Add as actual message to history so GROQ has context
            setMessages((prev) => [
              ...prev,
              {
                id: visionId,
                role: 'assistant' as const,
                content: analysisText,
                parts: [],
                createdAt: new Date(),
              },
            ]);

            toast.success('Imagen analizada', 'El análisis se ha agregado al chat');
          } else {
            const errorMsg = `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`;
            setMessages((prev) => [
              ...prev,
              {
                id: `vision-error-${Date.now()}`,
                role: 'assistant' as const,
                content: errorMsg,
                parts: [],
                createdAt: new Date(),
              },
            ]);
            toast.error('Error de visión', result.error || 'No se pudo analizar la imagen');
          }
        } catch (error: unknown) {
          console.error('Error processing image:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          const errorMsg = `❌ Error al procesar imagen: ${errorMessage}`;
          setMessages((prev) => [
            ...prev,
            {
              id: `vision-error-${Date.now()}`,
              role: 'assistant' as const,
              content: errorMsg,
              parts: [],
              createdAt: new Date(),
            },
          ]);
          toast.error('Error al procesar imagen', errorMessage);
        } finally {
          setIsAnalyzingImage(false);
        }

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
            model: DEFAULT_MODEL,
          },
        }
      );

      setInput('');
    },
    [isListening, toggleListening, setMessages, toast, sendMessage]
  );

  // Keyboard shortcuts
  useChatKeyboard({
    onSubmit: () => {
      if (input.trim() && canSend) {
        handleSubmit({ text: input, files: [] });
      }
    },
    onCancelVoice: () => {
      if (isListening) toggleListening();
    },
    onFocusInput: () => textareaRef.current?.focus(),
    canSubmit: Boolean(input.trim() && canSend),
    isListening,
  });

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        {/* Header */}
        <ChatHeader
          hasMessages={messages.length > 0}
          onClearHistory={() => setShowClearDialog(true)}
        />

        {/* Conversation Area */}
        <ChatConversation
          messages={messages}
          status={status}
          isVoiceSupported={isSupported}
          voiceMode={mode}
          onRegenerate={handleRegenerate}
          onCopyMessage={(text) => handleCopyMessage(text, toast)}
        />

        {/* Status Indicators */}
        <ChatStatusIndicators
          voiceError={voiceError}
          isListening={isListening}
          isProcessing={isProcessing}
          isAnalyzingImage={isAnalyzingImage}
          chatError={chatError}
          mode={mode}
        />

        {/* Input Area */}
        <ChatInputArea
          textareaRef={textareaRef}
          input={input}
          onInputChange={(e) => setInput(e.target.value)}
          onSubmit={handleSubmit}
          canSend={canSend}
          status={status}
          voiceProps={{
            isListening,
            isProcessing,
            isSupported,
            mode,
            onClick: toggleListening,
            disabled: !canSend || isProcessing,
          }}
        />
      </div>

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Borrar historial"
        description={CHAT_MESSAGES.CONFIRM_CLEAR_HISTORY}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleClear}
      />
    </div>
  );
}
