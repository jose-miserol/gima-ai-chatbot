import { useCallback } from 'react';

interface ToastFunctions {
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
}

interface UseChatActionsParams {
  regenerate: () => void;
  clearHistory: () => void;
  setInput: (value: string) => void;
}

/**
 * useChatActions - Hook para acciones del chat (regenerate, clear, copy)
 *
 * Encapsula la lógica de acciones comunes del chat:
 * - Regenerar: Vuelve a generar la última respuesta del asistente
 * - Limpiar: Borra todo el historial y resetea el input
 * - Copiar: Copia un mensaje al portapapeles y muestra toast
 *
 * @param regenerate - Función para regenerar la última respuesta
 * @param clearHistory - Función para borrar todo el historial
 * @param setInput - Setter para limpiar el input
 *
 * @returns Objeto con funciones handleRegenerate, handleClear, handleCopyMessage
 *
 * @example
 * ```tsx
 * const { handleRegenerate, handleClear, handleCopyMessage } = useChatActions({
 *   regenerate,
 *   clearHistory,
 *   setInput
 * });
 *
 * <MessageAction onClick={handleRegenerate} />
 * <Button onClick={handleClear} />
 * <MessageAction onClick={() => handleCopyMessage(text, toast)} />
 * ```
 */
export function useChatActions({ regenerate, clearHistory, setInput }: UseChatActionsParams) {
  const handleRegenerate = useCallback(() => {
    regenerate();
  }, [regenerate]);

  const handleClear = useCallback(() => {
    clearHistory();
    setInput('');
  }, [clearHistory, setInput]);

  const handleCopyMessage = useCallback((text: string, toast: ToastFunctions) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado', 'Mensaje copiado al portapapeles');
  }, []);

  return {
    handleRegenerate,
    handleClear,
    handleCopyMessage,
  };
}
