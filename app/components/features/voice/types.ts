/**
 * Voice Feature Types
 *
 * Type definitions for the voice input feature.
 */

/**
 * Voice recognition mode - either Gemini AI or native browser API
 */
export type VoiceMode = 'gemini' | 'native';

/**
 * Voice recording state
 *
 * Represents the current state of voice input.
 */
export interface VoiceState {
  /**
   * Whether the microphone is actively listening
   */
  isListening: boolean;

  /**
   * Whether audio is being processed/transcribed
   */
  isProcessing: boolean;

  /**
   * Current voice recognition mode
   */
  mode: VoiceMode;

  /**
   * Error message if voice input failed
   */
  error?: string;
}

/**
 * Props for the VoiceButton component
 */
export interface VoiceButtonProps {
  /**
   * Whether the microphone is actively listening
   */
  isListening: boolean;

  /**
   * Whether audio is being processed (optional, defaults to false)
   */
  isProcessing?: boolean;

  /**
   * Whether voice input is supported in the current browser
   */
  isSupported: boolean;

  /**
   * Current voice recognition mode (optional, defaults to 'native')
   */
  mode?: VoiceMode;

  /**
   * Click handler to toggle voice recording
   */
  onClick: () => void;

  /**
   * Whether the button should be disabled (optional)
   */
  disabled?: boolean;

  /**
   * Additional CSS classes (optional)
   */
  className?: string;
}
