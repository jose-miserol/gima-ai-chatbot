// Tipos compartidos para el sistema de chat

/**
 * Representa los diferentes tipos de contenido en una parte del mensaje
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string };

export interface SanitizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date;
}

export interface ChatAPIRequest {
  messages: SanitizedMessage[];
  model?: string;
}

export interface ChatAPIResponse {
  success: boolean;
  error?: string;
  data?: {
    text?: string;
    parts?: MessagePart[];
  };
}

// Tipos para mensajes raw que pueden venir malformados
export interface RawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | { parts?: MessagePart[]; text?: string };
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date | string;
}
