'use client';

import { useState, useCallback, useRef } from 'react';
import { usePersistentChat } from '@/app/hooks/use-persistent-chat';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { useToast } from '@/app/components/ui/toast';
import { ConfirmDialog } from '@/app/components/shared/ConfirmDialog';
import { ChatHeader } from './chat-header';
import { ChatConversation } from './chat-conversation';
import { ChatStatusIndicators } from './chat-status-bar';
import { ChatInputArea } from './chat-input-area';
import { CHAT_MESSAGES } from './constants';
import { useChatActions } from './hooks/use-chat-actions';
import { useChatKeyboard } from './hooks/use-chat-keyboard';
import { useImageSubmission } from './hooks/use-image-submission';
import { VoiceCommandMode } from '@/app/components/features/voice';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

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
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isCommandMode, setIsCommandMode] = useState(false);
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

  // Image submission handling
  const { handleSubmit, isAnalyzing } = useImageSubmission({
    setMessages,
    sendMessage,
    isListening,
    toggleListening,
  });

  // Chat actions
  const { handleRegenerate, handleClear, handleCopyMessage } = useChatActions({
    regenerate,
    clearHistory,
    setInput,
  });

  // Computed values
  const canSend =
    (status === 'ready' ||
      status === 'error' ||
      (status !== 'streaming' && status !== 'submitted')) &&
    !isAnalyzing;

  // Voice command handler
  const handleVoiceCommand = useCallback(
    async (command: VoiceWorkOrderCommand) => {
      // TODO: Connect to backend work order creation
      toast.info(
        'Comando recibido',
        `Acción: ${command.action}${command.equipment ? ` - Equipo: ${command.equipment}` : ''}`
      );
      setIsCommandMode(false);
    },
    [toast]
  );

  // Keyboard shortcuts
  useChatKeyboard({
    onSubmit: () => {
      if (input.trim() && canSend) {
        handleSubmit({ text: input, files: [] });
        setInput('');
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
          voiceError={voiceError ?? undefined}
          isListening={isListening}
          isProcessing={isProcessing}
          isAnalyzingImage={isAnalyzing}
          chatError={chatError}
          mode={mode}
        />

        {/* Voice Command Mode (when active) */}
        {isCommandMode && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Modo Comando de Voz
              </span>
              <button
                onClick={() => setIsCommandMode(false)}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Cancelar
              </button>
            </div>
            <VoiceCommandMode
              onCommandConfirmed={handleVoiceCommand}
              onError={(err) => toast.error('Error', err)}
              minConfidence={0.7}
            />
          </div>
        )}

        {/* Toggle Command Mode Button */}
        {!isCommandMode && (
          <button
            onClick={() => setIsCommandMode(true)}
            className="mb-2 text-xs text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
          >
            🎤 Usar comando de voz para órdenes de trabajo
          </button>
        )}

        {/* Input Area */}
        <ChatInputArea
          textareaRef={textareaRef}
          input={input}
          onInputChange={(e) => setInput(e.target.value)}
          onSubmit={handleSubmit}
          canSend={canSend}
          status={status}
          isAnalyzingImage={isAnalyzing}
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
