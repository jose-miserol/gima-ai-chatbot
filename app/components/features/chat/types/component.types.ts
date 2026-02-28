/**
 * Tipos de Props de Componentes
 *
 * Definiciones de tipos para todas las props de componentes de chat.
 * Organizado por componente para fácil mantenimiento.
 */

import type { UIMessage } from 'ai';
import type { PromptInputMessage } from '@components/ai-elements/prompt-input';
import type { VoiceButtonProps } from './voice-props.types';

/**
 * Props para el componente ChatEmptyState
 *
 * Define la interfaz para el estado vacío mostrado cuando no hay mensajes.
 * @property isVoiceSupported - Si la entrada de voz está disponible en el navegador
 * @property voiceMode - Modo actual de reconocimiento de voz (Gemini AI o nativo)
 */
export interface ChatEmptyStateProps {
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
}

/**
 * Props para el componente ChatMessage
 *
 * Define la interfaz para renderizar mensajes individuales del chat con acciones.
 * @property message - Datos del mensaje a mostrar (UIMessage de AI SDK)
 * @property onRegenerate - Callback para regenerar la respuesta del asistente
 * @property onCopy - Callback para copiar el texto del mensaje al portapapeles
 */
export interface ChatMessageProps {
  message: UIMessage;
  onRegenerate: () => void;
  onCopy: (text: string) => void;
}

/**
 * Props para el componente ChatConversation
 *
 * Define la interfaz para el área de conversación que muestra todos los mensajes.
 * @property messages - Array de todos los mensajes en la conversación (UIMessage de AI SDK)
 * @property status - Estado actual del chat (listo, transmitiendo, enviado, error)
 * @property isVoiceSupported - Si la entrada de voz está disponible
 * @property voiceMode - Modo actual de reconocimiento de voz
 * @property onRegenerate - Callback para regenerar último mensaje del asistente
 * @property onCopyMessage - Callback para copiar un mensaje al portapapeles
 */
export interface ChatConversationProps {
  messages: UIMessage[];
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
  onRegenerate: () => void;
  onCopyMessage: (text: string) => void;
  onQuickAction?: (prompt: string) => void;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
}

/**
 * Props para el componente ChatInputArea
 *
 * Define la interfaz para el área de input del usuario con adjuntos y voz.
 * @property textareaRef - Referencia al elemento textarea para control programático
 * @property input - Valor actual del input
 * @property onInputChange - Callback al cambiar el texto del input
 * @property onSubmit - Callback al enviar el mensaje
 * @property canSend - Si se permite enviar (basado en estado del chat)
 * @property status - Estado actual del chat
 * @property voiceProps - Props para pasar al componente VoiceButton
 */
export interface ChatInputAreaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (message: PromptInputMessage) => void;
  canSend: boolean;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  isAnalyzingFile: boolean;
  voiceProps: VoiceButtonProps;
  onQuickAction?: (prompt: string) => void;
}
