import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputHeader,
} from '@/app/components/ai-elements/prompt-input';
import { VoiceButton } from '@/app/components/features/voice';
import type { ChatInputAreaProps } from './types';

/**
 * ChatInputArea - Área de input del usuario
 *
 * Contiene todos los controles para ingresar mensajes:
 * - Textarea para texto
 * - Attachments (imágenes, archivos) con drag and drop
 * - Botón de voz (Gemini AI o Web Speech API nativa)
 * - Botón de envío
 *
 * Usa componentes de AI SDK Elements (PromptInput, PromptInputTextarea, etc).
 *
 * @param textareaRef - Ref del textarea para control programático
 * @param input - Valor actual del input
 * @param onInputChange - Callback al cambiar el input
 * @param onSubmit - Callback al enviar mensaje
 * @param canSend - Si se puede enviar (estado del chat)
 * @param status - Estado actual del chat
 * @param voiceProps - Props para el botón de voz customizado
 *
 * @example
 * ```tsx
 * <ChatInputArea
 *   textareaRef={textareaRef}
 *   input={input}
 *   onInputChange={(e) => setInput(e.target.value)}
 *   onSubmit={handleSubmit}
 *   canSend={canSend}
 *   status={status}
 *   voiceProps={{
 *     isListening,
 *     isProcessing,
 *     isSupported,
 *     mode,
 *     onClick: toggleListening,
 *     disabled: !canSend || isProcessing
 *   }}
 * />
 * ```
 */
export function ChatInputArea({
  textareaRef,
  input: _input, // Managed internally by PromptInputTextarea
  onInputChange,
  onSubmit,
  canSend,
  status,
  isAnalyzingFile: _isAnalyzingFile, // Reserved for future UI enhancements
  voiceProps,
}: ChatInputAreaProps) {
  return (
    <PromptInput
      onSubmit={onSubmit}
      className="mt-2"
      globalDrop
      multiple
      accept="image/*,application/pdf"
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>
        <PromptInputTextarea
          ref={textareaRef}
          onChange={onInputChange}
          placeholder="Escribe tu pregunta o sube imágenes/PDFs..."
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

          <VoiceButton {...voiceProps} />
        </PromptInputTools>

        <PromptInputSubmit disabled={!canSend} status={status} />
      </PromptInputFooter>
    </PromptInput>
  );
}
