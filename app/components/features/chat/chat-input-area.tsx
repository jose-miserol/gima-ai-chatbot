import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
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
import { DropdownMenuLabel, DropdownMenuSeparator } from '@/app/components/ui/dropdown-menu';
import { VoiceButton } from '@/app/components/features/voice';

import { QUICK_ACTIONS } from './chat-quick-actions';

import type { ChatInputAreaProps } from './types';

/**
 * ChatInputArea - Área de input del usuario
 *
 * Contiene todos los controles para ingresar mensajes:
 * - Textarea para texto
 * - Attachments (imágenes, archivos) con drag and drop
 * - Herramientas de IA (quick actions en el menú +)
 * - Botón de voz (Gemini AI o Web Speech API nativa)
 * - Botón de envío
 */
export function ChatInputArea({
  textareaRef,
  input: _input,
  onInputChange,
  onSubmit,
  canSend,
  status,
  isAnalyzingFile: _isAnalyzingFile,
  voiceProps,
  onQuickAction,
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

              {/* Herramientas de IA */}
              {onQuickAction && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Herramientas</DropdownMenuLabel>
                  {QUICK_ACTIONS.map((action) => (
                    <PromptInputActionMenuItem
                      key={action.label}
                      onClick={() => onQuickAction(action.prompt)}
                      className="gap-2 cursor-pointer"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </PromptInputActionMenuItem>
                  ))}
                </>
              )}
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>

          <VoiceButton {...voiceProps} />
        </PromptInputTools>

        <PromptInputSubmit disabled={!canSend} status={status} />
      </PromptInputFooter>
    </PromptInput>
  );
}
