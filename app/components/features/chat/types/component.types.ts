/**
 * Component Props Types
 *
 * Type definitions for all chat component props.
 * Organized by component for easy maintenance.
 */

import type { VoiceButtonProps } from './voice-props.types';

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
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (message: any) => void; // PromptInputMessage from ai-elements
  canSend: boolean;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  isAnalyzingFile: boolean;
  voiceProps: VoiceButtonProps;
}
