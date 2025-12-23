/**
 * Message Types
 *
 * Core message type definitions for the chat system.
 * Includes message parts, sanitized messages, and API request/response types.
 */

/**
 * Represents different types of content parts in a message
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string };

/**
 * Sanitized message interface for API communication
 *
 * Represents a cleaned message ready for API submission.
 */
export interface SanitizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date;
}

/**
 * Chat API request structure
 */
export interface ChatAPIRequest {
  messages: SanitizedMessage[];
  model?: string;
}

/**
 * Chat API response structure
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
 * Raw message interface for handling malformed data
 *
 * Used when receiving messages that may not be properly structured.
 */
export interface RawMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | { parts?: MessagePart[]; text?: string };
  parts?: MessagePart[];
  id?: string;
  createdAt?: Date | string;
}
