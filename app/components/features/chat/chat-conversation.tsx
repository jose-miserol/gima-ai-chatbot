import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/app/components/ai-elements/conversation';
import { Loader } from '@/app/components/ai-elements/loader';

import { ChatEmptyState } from './chat-empty-state';
import { ChatMessage } from './chat-message';

import type { ChatConversationProps } from './types';

/**
 * ChatConversation - Área de visualización de mensajes
 *
 * Gestiona la visualización de la conversación:
 * - Estado vacío cuando no hay mensajes
 * - Lista de mensajes
 * - Indicador de carga (skeleton)
 * - Scroll automático al final
 * - Botón de scroll to bottom
 *
 * Usa componentes de AI SDK Elements (Conversation, ConversationContent, ConversationScrollButton).
 * @param messages - Array de mensajes a mostrar
 * @param messages.messages
 * @param status - Estado actual del chat ('ready', 'streaming', etc.)
 * @param messages.status
 * @param isVoiceSupported - Si voz está disponible
 * @param messages.isVoiceSupported
 * @param voiceMode - Modo de voz actual
 * @param messages.voiceMode
 * @param onRegenerate - Callback para regenerar respuesta
 * @param messages.onRegenerate
 * @param onCopyMessage - Callback para copiar mensaje
 * @param messages.onCopyMessage
 * @example
 * ```tsx
 * <ChatConversation
 *   messages={messages}
 *   status={status}
 *   isVoiceSupported={isSupported}
 *   voiceMode={mode}
 *   onRegenerate={handleRegenerate}
 *   onCopyMessage={(text) => handleCopy(text, toast)}
 * />
 * ```
 */
export function ChatConversation({
  messages,
  status,
  isVoiceSupported,
  voiceMode,
  onRegenerate,
  onCopyMessage,
  onQuickAction,
  onToolApproval,
}: ChatConversationProps) {
  return (
    <Conversation className="h-full" initial="instant">
      <ConversationContent>
        {messages.length === 0 ? (
          <ChatEmptyState
            isVoiceSupported={isVoiceSupported}
            voiceMode={voiceMode}
            onQuickAction={onQuickAction}
          />
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={`${message.id}-${index}`}
              message={message}
              onRegenerate={onRegenerate}
              onCopy={onCopyMessage}
              onToolApproval={onToolApproval}
            />
          ))
        )}
        {status === 'submitted' && <Loader />}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
