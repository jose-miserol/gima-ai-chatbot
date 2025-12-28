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
 * @param params - Parámetros del hook
 * @param params.regenerate - Función para regenerar la última respuesta
 * @param params.clearHistory - Función para borrar todo el historial
 * @param params.setInput - Setter para limpiar el input
 * @returns Objeto con funciones handleRegenerate, handleClear, handleCopyMessage
 */
export function useChatActions({ regenerate, clearHistory, setInput }: UseChatActionsParams) {
  const handleRegenerate = useCallback(() => {
    regenerate();
  }, [regenerate]);

  const handleClear = useCallback(() => {
    clearHistory();
    setInput('');
  }, [clearHistory, setInput]);

  const handleCopyMessage = useCallback(async (text: string, toast: ToastFunctions) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado', 'Mensaje copiado al portapapeles');
    } catch {
      toast.error('Error', 'No se pudo copiar el mensaje');
    }
  }, []);

  return {
    handleRegenerate,
    handleClear,
    handleCopyMessage,
  };
}
