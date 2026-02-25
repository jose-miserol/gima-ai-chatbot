/**
 * ChatEmptyState — Estado vacío del chat con Quick Actions
 *
 * Muestra mensaje de bienvenida y botones de acción rápida
 * cuando no hay mensajes en la conversación.
 */

import { ChatQuickActions } from './chat-quick-actions';

interface ChatEmptyStateProps {
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
  onQuickAction?: (prompt: string) => void;
}

/**
 * ChatEmptyState — Estado vacío con quick actions
 *
 * @param isVoiceSupported - Si el reconocimiento de voz está disponible
 * @param voiceMode - Modo de voz actual ('gemini' o 'native')
 * @param onQuickAction - Callback al hacer click en un botón de acción rápida
 */
export function ChatEmptyState({
  isVoiceSupported,
  voiceMode,
  onQuickAction,
}: ChatEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      <div className="text-center space-y-4">
        <div>
          <p className="text-lg mb-2">Hola! Soy tu asistente de mantenimiento</p>
          <p className="text-sm">
            Pregúntame sobre equipos, procedimientos o solicita ayuda
          </p>
          {isVoiceSupported && (
            <p className="text-xs mt-2 text-gray-400">
              Puedes usar el micrófono para dictar
              {voiceMode === 'gemini' && ' (con IA)'}
            </p>
          )}
        </div>

        {/* Quick Action Buttons */}
        {onQuickAction && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-3">
              O prueba una acción rápida:
            </p>
            <ChatQuickActions onActionClick={onQuickAction} />
          </div>
        )}
      </div>
    </div>
  );
}
