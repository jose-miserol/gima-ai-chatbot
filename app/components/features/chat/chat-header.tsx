import { Trash2 } from 'lucide-react';

import { ThemeToggle } from '@/app/components/features/theme';
import { ChatHelp } from './chat-help';

interface ChatHeaderProps {
  hasMessages: boolean;
  onClearHistory: () => void;
}

/**
 * ChatHeader - Cabecera del chat con controles principales
 *
 * Muestra el título de la aplicación y proporciona acceso a:
 * - ThemeToggle: Cambiar entre tema claro/oscuro
 * - Botón de limpieza: Borrar todo el historial de conversación
 *
 * El botón para limpiar historial solo aparece cuando hay mensajes.
 * @param hasMessages - Indica si hay mensajes en la conversación (muestra botón de clear)
 * @param hasMessages.hasMessages
 * @param onClearHistory - Callback ejecutado al solicitar limpiar historial (abre confirmación)
 * @param hasMessages.onClearHistory
 * @example
 * ```tsx
 * <ChatHeader
 *   hasMessages={messages.length > 0}
 *   onClearHistory={() => setShowClearDialog(true)}
 * />
 * ```
 */
export function ChatHeader({ hasMessages, onClearHistory }: ChatHeaderProps) {
  return (
    <div className="mb-4 text-center relative">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">GIMA Chatbot</h1>
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        Asistente Inteligente de Mantenimiento - UNEG
      </p>

      {/* Theme Toggle & Clear History */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <ChatHelp />
        <ThemeToggle />
        {hasMessages && (
          <button
            onClick={onClearHistory}
            title="Borrar historial"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
            aria-label="Borrar historial de conversación"
          >
            <Trash2 className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
