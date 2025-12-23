/**
 * Constantes de la Funcionalidad de Voz
 *
 * Configuración centralizada para la funcionalidad de entrada de voz.
 * Contiene configuración para grabación de voz, procesamiento y UI.
 */

/**
 * Configuración de reconocimiento de voz
 */
export const VOICE_CONFIG = {
  /**
   * Tiempo máximo de grabación en milisegundos (30 segundos)
   */
  maxRecordingTime: 30000,

  /**
   * Frecuencia de muestreo para grabación de audio (Hz)
   */
  sampleRate: 16000,

  /**
   * Tipo MIME para codificación de audio
   */
  mimeType: 'audio/webm',

  /**
   * Configuración de forma de onda visual
   */
  waveform: {
    /**
     * Altura de las barras de forma de onda en píxeles
     */
    height: 16,

    /**
     * Número de barras de forma de onda a mostrar
     */
    bars: 4,
  },
} as const;

/**
 * Etiquetas y mensajes del botón de voz
 */
export const VOICE_LABELS = {
  /**
   * Etiqueta cuando está inactivo
   */
  idle: 'Dictar reporte',

  /**
   * Etiqueta cuando está escuchando
   */
  listening: 'Detener',

  /**
   * Etiqueta ARIA cuando está inactivo
   */
  ariaIdle: 'Iniciar grabación de voz',

  /**
   * Etiqueta ARIA cuando está escuchando
   */
  ariaListening: 'Detener grabación de voz',

  /**
   * Mensaje de estado cuando está procesando
   */
  processing: 'Procesando audio...',

  /**
   * Mensaje de estado cuando está listo
   */
  ready: 'Listo para grabar',

  /**
   * Indicador de escucha para modo Gemini
   */
  listeningGemini: 'IA Escuchando...',

  /**
   * Indicador de escucha para modo nativo
   */
  listeningNative: 'Grabando...',
} as const;
