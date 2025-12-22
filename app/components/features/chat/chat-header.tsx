import { Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/app/components/features/theme';

interface ChatHeaderProps {
  hasMessages: boolean;
  onClearHistory: () => void;
}

/**
 * Chat header component with title and controls
 *
 * Displays the chat title and provides controls for:
 * - Theme toggling
 * - Clearing conversation history
 */
export function ChatHeader({ hasMessages, onClearHistory }: ChatHeaderProps) {
  return (
    <div className="mb-4 text-center relative">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GIMA Chatbot</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Asistente Inteligente de Mantenimiento - UNEG
      </p>

      {/* Theme Toggle & Clear History */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
