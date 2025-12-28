/**
 * Chat Utilities - Funciones de utilidad para el procesamiento de mensajes
 *
 * Este módulo contiene la lógica de sanitización y transformación de mensajes.
 * Separado del API route para mejor testabilidad y reutilización.
 */

import type { MessagePart } from '@/app/types/chat.types';

import type { Message } from './schemas/chat';
import type { UIMessage } from 'ai';

/**
 * Extrae el contenido de texto de un mensaje
 *
 * Maneja los diferentes formatos que puede tener el contenido:
 * - String directo
 * - Objeto con propiedad `text`
 * - Objeto con array de `parts` que contiene partes de texto
 * @param content - El contenido del mensaje en cualquier formato válido
 * @param parts - Array opcional de partes del mensaje
 * @returns El texto extraído o string vacío si no se encuentra
 */
function extractTextContent(
  content: string | { parts?: MessagePart[]; text?: string } | undefined,
  parts?: MessagePart[]
): string {
  // Caso 1: Content es un string directo
  if (typeof content === 'string') {
    return content;
  }

  // Caso 2: Content es un objeto con propiedad text
  if (content && typeof content === 'object' && 'text' in content && content.text) {
    return content.text;
  }

  // Caso 3: Content es un objeto con parts
  if (content && typeof content === 'object' && 'parts' in content && content.parts) {
    const textPart = content.parts.find(
      (p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text'
    );
    if (textPart) {
      return textPart.text;
    }
  }

  // Caso 4: Hay parts en el nivel del mensaje
  if (parts && parts.length > 0) {
    const textPart = parts.find(
      (p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text'
    );
    if (textPart) {
      return textPart.text;
    }
  }

  // Fallback: string vacío
  return '';
}

/**
 * Sanitiza un array de mensajes para convertirlos al formato UIMessage
 *
 * Esta función:
 * - Asegura que content siempre sea un string
 * - Extrae texto de objetos con parts si es necesario
 * - Normaliza el campo createdAt a Date o undefined
 * - Preserva las parts originales para futuro soporte multimodal
 * @param rawMessages - Mensajes validados por Zod pero potencialmente con contenido mixto
 * @returns Array de mensajes sanitizados compatibles con UIMessage
 */
export function sanitizeMessages(rawMessages: Message[]): UIMessage[] {
  return rawMessages.map((msg) => {
    const textContent = extractTextContent(msg.content, msg.parts);

    return {
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      content: textContent,
      parts: msg.parts,
      createdAt: msg.createdAt,
    } as UIMessage;
  });
}

/**
 * Valida que un mensaje tenga contenido no vacío
 * @param message - Mensaje a validar
 * @returns true si el mensaje tiene contenido válido
 */
export function hasValidContent(message: UIMessage): boolean {
  // UIMessage tiene parts, necesitamos extraer el contenido de texto
  const textPart = message.parts?.find(
    (p): p is { type: 'text'; text: string } =>
      typeof p === 'object' && p !== null && 'type' in p && p.type === 'text'
  );
  const content = textPart?.text || '';
  return content.trim().length > 0;
}

/**
 * Filtra mensajes vacíos de un array
 * @param messages - Array de mensajes
 * @returns Array con solo mensajes que tienen contenido
 */
export function filterEmptyMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(hasValidContent);
}
