// Tipos compartidos para el sistema de chat

/**
 * Represents different types of content parts in a message
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

// =============================================================================
// Component Props Types (Phase 2)
// =============================================================================

/**
 * Props for ChatEmptyState component
 *
 * Defines the interface for the empty state shown when no messages exist.
 *
 * @property isVoiceSupported - Whether voice input is available in the browser
 * @property voiceMode - Current voice recognition mode (Gemini AI or native)
 */
export interface ChatEmptyStateProps {
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
}

/**
 * Props for ChatMessage component
 *
 * Defines the interface for rendering individual chat messages with actions.
 *
 * @property message - The message data to display (UIMessage from AI SDK)
 * @property onRegenerate - Callback to regenerate the assistant's response
 * @property onCopy - Callback to copy message text to clipboard
 */
export interface ChatMessageProps {
  message: any; // UIMessage from AI SDK
  onRegenerate: () => void;
  onCopy: (text: string) => void;
}

/**
 * Props for ChatConversation component
 *
 * Defines the interface for the conversation area that displays all messages.
 *
 * @property messages - Array of all messages in the conversation (UIMessage from AI SDK)
 * @property status - Current chat status (ready, streaming, submitted, error)
 * @property isVoiceSupported - Whether voice input is available
 * @property voiceMode - Current voice recognition mode
 * @property onRegenerate - Callback to regenerate last assistant message
 * @property onCopyMessage - Callback to copy a message to clipboard
 */
export interface ChatConversationProps {
  messages: any[]; // UIMessage from AI SDK
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
  onRegenerate: () => void;
  onCopyMessage: (text: string) => void;
}

/**
 * Props for VoiceButton component
 *
 * Defines the interface for the voice input button configuration.
 *
 * @property isListening - Whether voice recording is currently active
 * @property isProcessing - Whether voice is being processed by AI
 * @property isSupported - Whether voice input is supported in browser
 * @property mode - Current voice recognition mode
 * @property onClick - Callback to toggle voice recording
 * @property disabled - Whether the button should be disabled
 */
export interface VoiceButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  mode: 'gemini' | 'native';
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Props for ChatInputArea component
 *
 * Defines the interface for the user input area with attachments and voice.
 *
 * @property textareaRef - Ref to the textarea element for programmatic control
 * @property input - Current input value
 * @property onInputChange - Callback when input text changes
 * @property onSubmit - Callback when message is submitted
 * @property canSend - Whether sending is allowed (based on chat status)
 * @property status - Current chat status
 * @property voiceProps - Props to pass to the VoiceButton component
 */
export interface ChatInputAreaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (message: any) => void; // PromptInputMessage from ai-elements
  canSend: boolean;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  voiceProps: VoiceButtonProps;
}

// =============================================================================
// Hook Parameter Types (Phase 1)
// =============================================================================

/**
 * Parameters for useChatActions hook
 *
 * Defines the required callbacks for chat action management.
 *
 * @property regenerate - Function to regenerate the last assistant response
 * @property clearHistory - Function to clear all chat history
 * @property setInput - Function to update the input field value
 */
export interface UseChatActionsParams {
  regenerate: () => void;
  clearHistory: () => void;
  setInput: (value: string) => void;
}

/**
 * Parameters for useChatKeyboard hook
 *
 * Defines the callbacks for keyboard shortcut handling.
 *
 * @property onSubmit - Callback to submit the current message (Ctrl+Enter)
 * @property onCancelVoice - Callback to cancel voice recording (Esc)
 * @property onFocusInput - Callback to focus the input textarea (/)
 * @property canSubmit - Whether message submission is allowed
 * @property isListening - Whether voice recording is active
 */
export interface UseChatKeyboardParams {
  onSubmit: () => void;
  onCancelVoice: () => void;
  onFocusInput: () => void;
  canSubmit: boolean;
  isListening: boolean;
}

/**
 * Toast notification functions interface
 *
 * Defines the interface for toast notification methods.
 *
 * @property success - Show success toast notification
 * @property error - Show error toast notification
 */
export interface ToastFunctions {
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
}
