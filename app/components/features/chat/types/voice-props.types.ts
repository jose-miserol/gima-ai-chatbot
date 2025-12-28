/**
 * Tipos de Props de Voz
 *
 * Tipos específicos para props de componentes relacionados con voz.
 * Separado para evitar dependencias circulares.
 */

/**
 * Props para el componente VoiceButton
 *
 * Define la interfaz para la configuración del botón de entrada de voz.
 * @property isListening - Si la grabación de voz está actualmente activa
 * @property isProcessing - Si la voz está siendo procesada por IA
 * @property isSupported - Si la entrada de voz está soportada en el navegador
 * @property mode - Modo actual de reconocimiento de voz
 * @property onClick - Callback para alternar grabación de voz
 * @property disabled - Si el botón debe estar deshabilitado
 */
export interface VoiceButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  mode: 'gemini' | 'native';
  onClick: () => void;
  disabled?: boolean;
}
