/**
 * Voice Props Types
 *
 * Specific types for voice-related component props.
 * Separated to avoid circular dependencies.
 */

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
