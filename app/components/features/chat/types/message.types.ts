/**
 * Tipos de Mensajes
 *
 * Definiciones de tipos de mensajes core para el sistema de chat.
 * Incluye partes de mensaje, mensajes sanitizados y tipos de petición/respuesta API.
 */

/**
 * Representa diferentes tipos de partes de contenido en un mensaje
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string };

/**
 * Interfaz de mensaje sanitizado para comunicación API
 *
 * Representa un mensaje limpio listo para envío a API.
 */
export interface SanitizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date;
}

/**
 * Estructura de petición API de Chat
 */
export interface ChatAPIRequest {
  messages: SanitizedMessage[];
  model?: string;
}

/**
 * Estructura de respuesta API de Chat
 */
export interface ChatAPIResponse {
  success: boolean;
  error?: string;
  data?: {
    text?: string;
    parts?: MessagePart[];
  };
}

/**
 * Interfaz de mensaje crudo para manejo de datos malformados
 *
 * Usado al recibir mensajes que pueden no estar bien estructurados.
 */
export interface RawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | { parts?: MessagePart[]; text?: string };
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date | string;
}
