import { Trash2, LayoutDashboard } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

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
import { env } from '@/app/config';
import { cn } from '@/app/lib/utils';

export function ChatHeader({ hasMessages, onClearHistory }: ChatHeaderProps) {
  return (
    <div className="mb-4 text-center relative">
      <Image
        src="/logotype.svg"
        alt="GIMA"
        width={80}
        height={40}
        className="mx-auto mb-2 dark:invert"
        priority
      />
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        Asistente Inteligente de Mantenimiento - UNEG
      </p>

      {/* Theme Toggle & Clear History */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <ChatHelp />
        <ThemeToggle />
        <Link
          href="http://localhost:3000"
          title="Ir al Dashboard"
          className={cn(
            'flex items-center justify-center rounded-lg border transition-all duration-200',
            'border-zinc-200 dark:border-zinc-700',
            'bg-white dark:bg-zinc-900',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            'hover:border-zinc-300 dark:hover:border-zinc-600',
            'text-zinc-600 dark:text-zinc-400',
            'hover:text-zinc-900 dark:hover:text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900',
            'p-2 text-gray-500 hover:text-[#001F3F] hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors flex items-center'
          )}
        >
          <LayoutDashboard className="size-5 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm font-medium">Ir a Dashboard</span>
        </Link>
        {env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE && hasMessages && (
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
