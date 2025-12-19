// Tipos compartidos para el sistema de chat

export interface SanitizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text?: string }>;
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
  data?: any;
}

// Tipos para mensajes raw que pueden venir malformados
export interface RawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | { parts?: Array<{ type: string; text?: string }> };
  parts?: Array<{ type: string; text?: string }>;
  id?: string;
  createdAt?: Date | string;
}
