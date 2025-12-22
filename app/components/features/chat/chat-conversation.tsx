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
 *
 * @param messages - Array de mensajes a mostrar
 * @param status - Estado actual del chat ('ready', 'streaming', etc.)
 * @param isVoiceSupported - Si voz está disponible
 * @param voiceMode - Modo de voz actual
 * @param onRegenerate - Callback para regenerar respuesta
 * @param onCopyMessage - Callback para copiar mensaje
 *
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
}: ChatConversationProps) {
  return (
    <Conversation className="h-full">
      <ConversationContent>
        {messages.length === 0 ? (
          <ChatEmptyState isVoiceSupported={isVoiceSupported} voiceMode={voiceMode} />
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onRegenerate={onRegenerate}
              onCopy={onCopyMessage}
            />
          ))
        )}
        {status === 'submitted' && <Loader />}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
