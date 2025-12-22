interface ChatEmptyStateProps {
  isVoiceSupported: boolean;
  voiceMode: 'gemini' | 'native';
}

/**
 * ChatEmptyState - Estado vacío del chat
 *
 * Muestra mensaje de bienvenida y sugerencias de uso:
 * - Título de bienvenida
 * - Descripción de funcionalidades
 * - Indicador de voz disponible (si aplica)
 *
 * @param isVoiceSupported - Si el reconocimiento de voz está disponible
 * @param voiceMode - Modo de voz actual ('gemini' o 'native')
 *
 * @example
 * ```tsx
 * <ChatEmptyState
 *   isVoiceSupported={true}
 *   voiceMode="gemini"
 * />
 * ```
 */
export function ChatEmptyState({ isVoiceSupported, voiceMode }: ChatEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      <div className="text-center">
        <p className="text-lg mb-2">Hola! Soy tu asistente de mantenimiento</p>
        <p className="text-sm">Pregúntame sobre equipos, procedimientos o solicita ayuda</p>
        {isVoiceSupported && (
          <p className="text-xs mt-2 text-gray-400">
            Puedes usar el micrófono para dictar
            {voiceMode === 'gemini' && ' (con IA)'}
          </p>
        )}
      </div>
    </div>
  );
}
