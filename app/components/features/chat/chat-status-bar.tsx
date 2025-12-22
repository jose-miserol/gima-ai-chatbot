import { Loader2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface ChatStatusIndicatorsProps {
  voiceError?: string;
  isListening: boolean;
  isProcessing: boolean;
  isAnalyzingImage: boolean;
  chatError?: Error;
  mode?: 'gemini' | 'native';
}

/**
 * Chat status indicators component
 *
 * Displays visual feedback for various chat states:
 * - Voice recording status (listening, processing)
 * - Image analysis progress
 * - Chat errors
 */
export function ChatStatusIndicators({
  voiceError,
  isListening,
  isProcessing,
  isAnalyzingImage,
  chatError,
  mode = 'native',
}: ChatStatusIndicatorsProps) {
  return (
    <div className="min-h-[36px] flex items-center justify-center">
      {voiceError && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
          <span>{voiceError}</span>
        </div>
      )}
      {isListening && !voiceError && (
        <div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs',
            mode === 'gemini'
              ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                mode === 'gemini' ? 'bg-blue-400' : 'bg-gray-400'
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full size-2',
                mode === 'gemini' ? 'bg-blue-500' : 'bg-gray-500'
              )}
            />
          </span>
          {mode === 'gemini' ? 'Grabando para IA...' : 'Escuchando...'}
        </div>
      )}
      {isProcessing && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs">
          <Loader2 className="size-3 animate-spin" />
          Procesando voz con IA...
        </div>
      )}
      {isAnalyzingImage && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
          <Loader2 className="size-3 animate-spin" />
          📷 Analizando imagen con IA...
        </div>
      )}
      {chatError && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <span>❌ Error de conexión - Intenta de nuevo</span>
        </div>
      )}
    </div>
  );
}
