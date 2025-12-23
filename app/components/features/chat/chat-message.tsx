import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageAttachments,
  MessageAttachment,
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
  // Si parts está vacío o no existe, renderizar usando content directamente
  if (!message.parts || message.parts.length === 0) {
    return (
      <Message key={message.id} from={message.role}>
        <MessageContent>
          <MessageResponse>{message.content}</MessageResponse>
        </MessageContent>
        {message.role === 'assistant' && (
          <MessageActions>
            <MessageAction onClick={onRegenerate} label="Reintentar">
              <RefreshCcwIcon className="size-3" />
            </MessageAction>
            <MessageAction onClick={() => onCopy(message.content)} label="Copiar">
              <CopyIcon className="size-3" />
            </MessageAction>
          </MessageActions>
        )}
      </Message>
    );
  }

  // Renderizar usando parts
  const textParts = message.parts.filter((part: any) => part.type === 'text');
  const imageParts = message.parts.filter((part: any) => part.type === 'image');
  const textContent = textParts.map((part: any) => part.text).join('\n\n');

  return (
    <Message key={message.id} from={message.role}>
      {/* Mostrar imágenes primero si existen */}
      {imageParts.length > 0 && (
        <MessageAttachments>
          {imageParts.map((part: any, i: number) => (
            <MessageAttachment
              key={`${message.id}-img-${i}`}
              data={{
                type: 'file',
                url: part.imageUrl,
                mediaType: part.mimeType || 'image/jpeg',
                filename: `image-${i + 1}.jpg`,
              }}
            />
          ))}
        </MessageAttachments>
      )}

      {/* Mostrar contenido de texto */}
      {textContent && (
        <MessageContent>
          <MessageResponse>{textContent}</MessageResponse>
        </MessageContent>
      )}

      {/* Acciones solo para mensajes del asistente */}
      {message.role === 'assistant' && textContent && (
        <MessageActions>
          <MessageAction onClick={onRegenerate} label="Reintentar">
            <RefreshCcwIcon className="size-3" />
          </MessageAction>
          <MessageAction onClick={() => onCopy(textContent)} label="Copiar">
            <CopyIcon className="size-3" />
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  );
}
