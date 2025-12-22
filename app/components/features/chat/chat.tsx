'use client';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/app/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/app/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputHeader,
} from '@/app/components/ai-elements/prompt-input';
import { Loader } from '@/app/components/ai-elements/loader';
import { VoiceButton } from '@/app/components/features/voice';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { usePersistentChat } from '@/app/hooks/use-persistent-chat';
import { useState, useCallback, useRef } from 'react';
import { CopyIcon, RefreshCcwIcon, Loader2, Trash2 } from 'lucide-react';
import { DEFAULT_MODEL } from '@/app/config';
import { analyzePartImage } from '@/app/actions';
import { useToast } from '@/app/components/ui/toast';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { ThemeToggle } from '@/app/components/features/theme';
import { CHAT_CONFIG, CHAT_MESSAGES } from './constants';
import { ConfirmDialog } from '@/app/components/shared/ConfirmDialog';

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
 * - useKeyboardShortcuts: Atajos de teclado
 * - analyzePartImage: Server action para análisis de visión
 *
 * @example
 * ```tsx
 * // Uso en page.tsx
 * <Chat />
 * ```
 */
export function Chat() {
  const [input, setInput] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const {
    messages,
    sendMessage,
    status,
    regenerate,
    error: chatError,
    visionResponse,
    setVisionResponse,
    clearHistory,
    setMessages,
  } = usePersistentChat({ storageKey: 'gima-chat-v1' });

  // Check if status allows sending (ready, error, or after image analysis)
  const canSend =
    status === 'ready' || status === 'error' || (status !== 'streaming' && status !== 'submitted');

  // Update textarea value programmatically
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

  // Voice input with Gemini + native fallback
  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: (text) => {
      // Append or replace based on mode
      if (mode === 'gemini') {
        // Gemini returns full text at once
        updateTextareaValue(text);
      } else {
        // Native returns incrementally
        updateTextareaValue(text);
      }
    },
  });

  // Keyboard shortcuts
  useKeyboardShortcuts(
    [
      {
        key: 'Enter',
        ctrlKey: true,
        handler: () => {
          if (input.trim() && canSend) {
            handleSubmit({ text: input, files: [] });
          }
        },
        description: 'Enviar mensaje',
      },
      {
        key: 'Escape',
        handler: () => {
          if (isListening) {
            toggleListening();
          }
        },
        description: 'Cancelar grabación de voz',
      },
      {
        key: '/',
        handler: () => {
          textareaRef.current?.focus();
        },
        description: 'Enfocar textarea',
      },
    ],
    !isAnalyzingImage
  );

  const handleSubmit = async (message: PromptInputMessage) => {
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
          // Include clear context that this was from an uploaded image
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
              parts: [{ type: 'text' as const, text: analysisText }],
              createdAt: new Date(),
            },
          ]);

          setVisionResponse(null);
          toast.success('Imagen analizada', 'El análisis se ha agregado al chat');
        } else {
          // If vision fails, show error
          const errorMsg = `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`;
          setMessages((prev) => [
            ...prev,
            {
              id: `vision-error-${Date.now()}`,
              role: 'assistant' as const,
              content: errorMsg,
              parts: [{ type: 'text' as const, text: errorMsg }],
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
            parts: [{ type: 'text' as const, text: errorMsg }],
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
          model: DEFAULT_MODEL, // Always use default model
        },
      }
    );

    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4 text-center relative">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GIMA Chatbot</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Asistente Inteligente de Mantenimiento - UNEG
          </p>

          {/* Theme Toggle & Clear History */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <ThemeToggle />
            {(messages.length > 0 || visionResponse) && (
              <button
                onClick={() => setShowClearDialog(true)}
                title="Borrar historial"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                aria-label="Borrar historial de conversación"
              >
                <Trash2 className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation Area */}
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && !visionResponse && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">👋 ¡Hola! Soy tu asistente de mantenimiento</p>
                  <p className="text-sm">
                    Pregúntame sobre equipos, procedimientos o solicita ayuda
                  </p>
                  {isSupported && (
                    <p className="text-xs mt-2 text-gray-400">
                      🎤 Puedes usar el micrófono para dictar
                      {mode === 'gemini' && ' (con IA)'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                        {message.role === 'assistant' && i === message.parts.length - 1 && (
                          <MessageActions>
                            <MessageAction onClick={() => regenerate()} label="Reintentar">
                              <RefreshCcwIcon className="size-3" />
                            </MessageAction>
                            <MessageAction
                              onClick={() => {
                                navigator.clipboard.writeText(part.text);
                                toast.success('Copiado', 'Mensaje copiado al portapapeles');
                              }}
                              label="Copiar"
                            >
                              <CopyIcon className="size-3" />
                            </MessageAction>
                          </MessageActions>
                        )}
                      </Message>
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Voice Status Indicators */}
        <div className="min-h-[36px] flex items-center justify-center">
          {voiceError && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
              <span>{voiceError}</span>
            </div>
          )}
          {isListening && !voiceError && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                mode === 'gemini'
                  ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="relative flex size-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mode === 'gemini' ? 'bg-blue-400' : 'bg-gray-400'}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full size-2 ${mode === 'gemini' ? 'bg-blue-500' : 'bg-gray-500'}`}
                ></span>
              </span>
              {mode === 'gemini' ? 'Grabando para IA...' : 'Escuchando...'}
            </div>
          )}
          {isProcessing && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs">
              <Loader2 className="size-3 animate-spin" />
              Procesando voz con IA...
            </div>
          )}
          {isAnalyzingImage && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
              <Loader2 className="size-3 animate-spin" />
              📷 Analizando imagen con IA...
            </div>
          )}
          {chatError && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
              <span>❌ Error de conexión - Intenta de nuevo</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <PromptInput onSubmit={handleSubmit} className="mt-2" globalDrop multiple>
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>

          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta sobre mantenimiento..."
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              {/* Voice Button */}
              <VoiceButton
                isListening={isListening}
                isProcessing={isProcessing}
                isSupported={isSupported}
                mode={mode}
                onClick={toggleListening}
                disabled={!canSend || isProcessing}
              />
            </PromptInputTools>

            <PromptInputSubmit disabled={!input || !canSend} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>

      {/* Accessible Confirm Dialog */}
      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Borrar historial"
        description={CHAT_MESSAGES.CONFIRM_CLEAR_HISTORY}
        confirmLabel="Borrar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          clearHistory();
          setInput('');
        }}
      />
    </div>
  );
}
