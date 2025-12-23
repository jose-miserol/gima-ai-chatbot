/**
 * Voice Feature Constants
 *
 * Centralized configuration for the voice input feature.
 * Contains configuration for voice recording, processing, and UI.
 */

/**
 * Voice recognition configuration
 */
export const VOICE_CONFIG = {
  /**
   * Maximum recording time in milliseconds (30 seconds)
   */
  maxRecordingTime: 30000,

  /**
   * Sample rate for audio recording (Hz)
   */
  sampleRate: 16000,

  /**
   * MIME type for audio encoding
   */
  mimeType: 'audio/webm',

  /**
   * Visual waveform configuration
   */
  waveform: {
    /**
     * Height of the waveform bars in pixels
     */
    height: 16,

    /**
     * Number of waveform bars to display
     */
    bars: 4,
  },
} as const;

/**
 * Voice button labels and messages
 */
export const VOICE_LABELS = {
  /**
   * Label when idle
   */
  idle: 'Dictar reporte',

  /**
   * Label when listening
   */
  listening: 'Detener',

  /**
   * ARIA label when idle
   */
  ariaIdle: 'Iniciar grabación de voz',

  /**
   * ARIA label when listening
   */
  ariaListening: 'Detener grabación de voz',

  /**
   * Status message when processing
   */
  processing: 'Procesando audio...',

  /**
   * Status message when ready
   */
  ready: 'Listo para grabar',

  /**
   * Listening indicator for Gemini mode
   */
  listeningGemini: 'IA Escuchando...',

  /**
   * Listening indicator for native mode
   */
  listeningNative: 'Grabando...',
} as const;
