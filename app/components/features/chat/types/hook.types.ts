/**
 * Hook Parameter Types
 *
 * Type definitions for custom hook parameters.
 * Includes chat actions, keyboard shortcuts, and toast notifications.
 */

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
