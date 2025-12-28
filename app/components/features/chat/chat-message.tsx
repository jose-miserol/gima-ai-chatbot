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

// Definición de tipos para las partes del mensaje
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image'; imageUrl: string; mimeType?: string; }

/**
 * Extrae el contenido de texto de las partes del mensaje
 */
function getTextContent(parts: unknown[] | undefined): string {
  if (!parts || parts.length === 0) return '';
  const textParts = parts.filter((part: any): part is TextPart => part?.type === 'text');
  return textParts.map((part) => part.text).join('\n\n');
}

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
 * @param props - Props del componente
 * @param props.message - Datos del mensaje a mostrar
 * @param props.onRegenerate - Callback para regenerar la respuesta
 * @param props.onCopy - Callback para copiar el texto
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
  // Extraer contenido de texto de las partes
  const textContent = getTextContent(message.parts as unknown[]);

  // Extraer partes de imagen si existen
  const imageParts = (message.parts as unknown[] || []).filter(
    (part: any): part is ImagePart => part?.type === 'image'
  );

  // Si no hay contenido, no renderizar nada
  if (!textContent && imageParts.length === 0) {
    return null;
  }

  return (
    <Message key={message.id} from={message.role}>
      {/* Mostrar imágenes primero si existen */}
      {imageParts.length > 0 && (
        <MessageAttachments>
          {imageParts.map((part, i) => (
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

