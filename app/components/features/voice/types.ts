/**
 * Tipos de la Funcionalidad de Voz
 *
 * Definiciones de tipos para la funcionalidad de entrada de voz.
 */

/**
 * Modo de reconocimiento de voz - Gemini AI o API nativa del navegador
 */
export type VoiceMode = 'gemini' | 'native';

/**
 * Estado de grabación de voz
 *
 * Representa el estado actual de la entrada de voz.
 */
export interface VoiceState {
  /**
   * Si el micrófono está escuchando activamente
   */
  isListening: boolean;

  /**
   * Si el audio se está procesando/transcribiendo
   */
  isProcessing: boolean;

  /**
   * Modo actual de reconocimiento de voz
   */
  mode: VoiceMode;

  /**
   * Mensaje de error si falla la entrada de voz
   */
  error?: string;
}

/**
 * Props para el componente VoiceButton
 */
export interface VoiceButtonProps {
  /**
   * Si el micrófono está escuchando activamente
   */
  isListening: boolean;

  /**
   * Si el audio se está procesando (opcional, por defecto false)
   */
  isProcessing?: boolean;

  /**
   * Si la entrada de voz está soportada en el navegador actual
   */
  isSupported: boolean;

  /**
   * Modo actual de reconocimiento de voz (opcional, por defecto 'native')
   */
  mode?: VoiceMode;

  /**
   * Manejador de click para alternar grabación de voz
   */
  onClick: () => void;

  /**
   * Si el botón debe estar deshabilitado (opcional)
   */
  disabled?: boolean;

  /**
   * Clases CSS adicionales (opcional)
   */
  className?: string;
}
