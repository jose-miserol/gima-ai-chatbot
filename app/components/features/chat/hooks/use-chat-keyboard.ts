import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';

interface UseChatKeyboardParams {
  onSubmit: () => void;
  onCancelVoice: () => void;
  onFocusInput: () => void;
  canSubmit: boolean;
  isListening: boolean;
}

/**
 * useChatKeyboard - Hook para keyboard shortcuts específicos del chat
 *
 * Configura los atajos de teclado del chat usando el hook global useKeyboardShortcuts:
 * - Ctrl+Enter: Enviar mensaje (si hay texto y se puede enviar)
 * - Escape: Cancelar grabación de voz (si está grabando)
 * - Slash (/): Hacer focus en el textarea de input
 *
 * Los shortcuts se deshabilitan automáticamente si el chat está en un estado
 * que no permite interacción (ej: durante análisis de imagen).
 * @param onSubmit - Callback para enviar el mensaje actual
 * @param onSubmit.onSubmit
 * @param onCancelVoice - Callback para cancelar la grabación de voz
 * @param onSubmit.onCancelVoice
 * @param onFocusInput - Callback para hacer focus en el textarea
 * @param onSubmit.onFocusInput
 * @param canSubmit - Si el mensaje actual puede enviarse
 * @param onSubmit.canSubmit
 * @param isListening - Si está grabando voz actualmente
 * @param onSubmit.isListening
 * @example
 * ```tsx
 * useChatKeyboard({
 *   onSubmit: () => handleSubmit({ text: input, files: [] }),
 *   onCancelVoice: () => { if (isListening) toggleListening(); },
 *   onFocusInput: () => textareaRef.current?.focus(),
 *   canSubmit: Boolean(input.trim() && canSend),
 *   isListening
 * });
 * ```
 */
export function useChatKeyboard({
  onSubmit,
  onCancelVoice,
  onFocusInput,
  canSubmit,
  isListening,
}: UseChatKeyboardParams) {
  useKeyboardShortcuts(
    [
      {
        key: 'Enter',
        ctrlKey: true,
        handler: onSubmit,
        description: 'Enviar mensaje',
      },
      {
        key: 'Escape',
        handler: onCancelVoice,
        description: 'Cancelar grabación de voz',
      },
      {
        key: '/',
        handler: onFocusInput,
        description: 'Enfocar textarea',
      },
    ],
    canSubmit && !isListening
  );
}
