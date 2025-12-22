import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/app/components/ai-elements/message';
import { CopyIcon, RefreshCcwIcon } from 'lucide-react';
import type { ChatMessageProps } from './types';

/**
 * ChatMessage - Mensaje individual del chat con acciones
 *
 * Renderiza un mensaje de usuario o asistente con:
 * - Contenido del mensaje (texto)
 * - Acciones (solo para mensajes del asistente)
 *   - Regenerar respuesta
 *   - Copiar al portapapeles
 *
 * Usa componentes de AI SDK Elements (Message, MessageContent, MessageActions).
 *
 * @param message - Datos del mensaje a mostrar
 * @param onRegenerate - Callback para regenerar la respuesta
 * @param onCopy - Callback para copiar el texto
 *
 * @example
 * ```tsx
 * <ChatMessage
 *   message={message}
 *   onRegenerate={() => regenerate()}
 *   onCopy={(text) => handleCopy(text, toast)}
 * />
 * ```
 */
export function ChatMessage({ message, onRegenerate, onCopy }: ChatMessageProps) {
  return (
    <div>
      {message.parts?.map((part: any, i: number) => {
        if (part.type === 'text') {
          return (
            <Message key={`${message.id}-${i}`} from={message.role}>
              <MessageContent>
                <MessageResponse>{part.text}</MessageResponse>
              </MessageContent>
              {message.role === 'assistant' && i === (message.parts?.length ?? 0) - 1 && (
                <MessageActions>
                  <MessageAction onClick={onRegenerate} label="Reintentar">
                    <RefreshCcwIcon className="size-3" />
                  </MessageAction>
                  <MessageAction onClick={() => onCopy(part.text)} label="Copiar">
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
  );
}
