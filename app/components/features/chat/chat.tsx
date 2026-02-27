'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import { executeVoiceCommand } from '@/app/actions';
import { VoiceCommandMode } from '@/app/components/features/voice';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useToast } from '@/app/components/ui/toast';
import { usePersistentChat } from '@/app/hooks/use-persistent-chat';
import { useVoiceInput } from '@/app/hooks/use-voice-input';
import { useWorkOrderCommands } from '@/app/hooks/use-work-order-commands';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

import { ChatConversation } from './chat-conversation';
import { ChatHeader } from './chat-header';
import { ChatInputArea } from './chat-input-area';
import { QUICK_ACTIONS, QuickActionDataForm } from './chat-quick-actions';
import { ChatStatusIndicators } from './chat-status-bar';
import { CHAT_MESSAGES } from './constants';
import { useChatActions } from './hooks/use-chat-actions';
import { useChatKeyboard } from './hooks/use-chat-keyboard';
import { useFileSubmission } from './hooks/use-file-submission';

import type { QuickAction } from './chat-quick-actions';


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
  const [detectedCommand, setDetectedCommand] = useState<VoiceWorkOrderCommand | null>(null);
  const [activeQuickAction, setActiveQuickAction] = useState<QuickAction | null>(null);
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
    addToolOutput,
  } = usePersistentChat({ storageKey: 'gima-chat-v1', enablePersistence: true });

  // Hook de ejecución de Work Orders
  const { executeCommand } = useWorkOrderCommands();

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
    transcript,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({ onTranscript: updateTextareaValue });

  // File submission handling (Images & PDFs)
  const { handleSubmit, isAnalyzing, analyzingFileType } = useFileSubmission({
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
      try {
        const result = await executeCommand(command);
        toast.success(result.message, `ID: ${result.resourceId}`);
        setIsCommandMode(false);
      } catch (err) {
        toast.error(
          'Error al crear orden',
          err instanceof Error ? err.message : 'Error desconocido'
        );
      }
    },
    [executeCommand, toast]
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

  // Quick action handler
  const handleQuickAction = useCallback(
    (prompt: string) => {
      // Find the matching QuickAction to check if it has formFields
      const action = QUICK_ACTIONS.find((a) => a.prompt === prompt);

      if (action?.formFields && action.formFields.length > 0) {
        // Action requires data → show inline form
        setActiveQuickAction(action);
        return;
      }

      // If prompt is complete (doesn't end in space), send directly
      if (!prompt.endsWith(' ')) {
        handleSubmit({ text: prompt, files: [] });
      } else {
        // Incomplete prompt - put in input and focus textarea
        updateTextareaValue(prompt);
        textareaRef.current?.focus();
      }
    },
    [handleSubmit, updateTextareaValue]
  );

  // Quick action form submit handler
  const handleQuickActionFormSubmit = useCallback(
    (composedPrompt: string) => {
      setActiveQuickAction(null);
      handleSubmit({ text: composedPrompt, files: [] });
    },
    [handleSubmit]
  );

  // Tool approval handler (for crear_orden_trabajo)
  const handleToolApproval = useCallback(
    (toolCallId: string, output: string) => {
      addToolOutput({
        tool: 'crear_orden_trabajo',
        toolCallId,
        output,
      });
    },
    [addToolOutput]
  );

  // Auto-detect voice commands
  const prevIsListening = useRef(false);
  const prevIsProcessing = useRef(false);

  useEffect(() => {
    const isGeminiFinish = prevIsProcessing.current && !isProcessing;
    const isNativeFinish = prevIsListening.current && !isListening && !isProcessing;

    // Use transcript directly to avoid state sync issues
    if ((isGeminiFinish || isNativeFinish) && transcript.trim().length > 5) {
      const checkCommand = async () => {
        try {
          // Check if transcript is a command
          const result = await executeVoiceCommand(transcript, { minConfidence: 0.6 });

          if (result.success && result.command) {
            setDetectedCommand(result.command as VoiceWorkOrderCommand);
          }
        } catch (error) {
          console.error('Error detecting voice command:', error);
        }
      };

      void checkCommand();
    }

    prevIsListening.current = isListening;
    prevIsProcessing.current = isProcessing;
  }, [isListening, isProcessing, transcript]);

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
          onQuickAction={handleQuickAction}
          onToolApproval={(approvalId: string, approved: boolean) =>
            handleToolApproval(approvalId, approved ? 'Aprobado por el usuario' : 'Rechazado por el usuario')
          }
        />

        {/* Status Indicators */}
        <ChatStatusIndicators
          voiceError={voiceError ?? undefined}
          isListening={isListening}
          isProcessing={isProcessing}
          isAnalyzingImage={isAnalyzing}
          fileType={analyzingFileType || 'image'}
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
              onCommandExecuted={(result) => {
                toast.success('Orden creada', result.message);
                setIsCommandMode(false);
              }}
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

        {/* Auto-detected Command Alert */}
        {detectedCommand && (
          <div className="absolute bottom-24 left-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in">
            <div className="bg-background border border-border shadow-lg rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-1">Comando detectado</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {detectedCommand.action}{' '}
                  {detectedCommand.equipment ? `- ${detectedCommand.equipment}` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleVoiceCommand(detectedCommand);
                      setDetectedCommand(null);
                      setInput('');
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    Ejecutar
                  </button>
                  <button
                    onClick={() => setDetectedCommand(null)}
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
              <button
                onClick={() => setDetectedCommand(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* QuickAction Data Form (inline, above input) */}
        {activeQuickAction && (
          <QuickActionDataForm
            action={activeQuickAction}
            onSubmit={handleQuickActionFormSubmit}
            onCancel={() => setActiveQuickAction(null)}
          />
        )}

        {/* Input Area */}
        <ChatInputArea
          textareaRef={textareaRef}
          input={input}
          onInputChange={(e) => setInput(e.target.value)}
          onSubmit={handleSubmit}
          canSend={canSend}
          status={status}
          isAnalyzingFile={isAnalyzing}
          onQuickAction={handleQuickAction}
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
