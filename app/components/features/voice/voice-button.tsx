'use client';

import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { AudioWaveform } from './audio-waveform';

interface VoiceButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  isSupported: boolean;
  mode?: 'gemini' | 'native';
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({
  isListening,
  isProcessing = false,
  isSupported,
  mode = 'native',
  onClick,
  disabled = false,
  className,
}: VoiceButtonProps) {
  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Expanded visual indicator when listening */}
      {isListening && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-full text-blue-600 dark:text-blue-400 text-xs font-medium animate-in fade-in slide-in-from-right-4 duration-300">
          <AudioWaveform active={true} />
          <span>{mode === 'gemini' ? 'IA Escuchando...' : 'Grabando...'}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative flex items-center justify-center size-9 rounded-full transition-all duration-300 shadow-sm border',
          // Base styles
          'hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2',

          // State: Listening (Blue for AI, Gray for native)
          isListening
            ? mode === 'gemini'
              ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 dark:shadow-blue-900/50 ring-2 ring-blue-200 dark:ring-blue-800'
              : 'bg-gray-500 border-gray-500 text-white shadow-gray-200 ring-2 ring-gray-200'
            : // State: Processing
              isProcessing
              ? 'bg-amber-100 border-amber-200 text-amber-600 cursor-wait'
              : // State: Idle (Normal)
                'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:text-zinc-200 dark:hover:bg-zinc-800',

          disabled && 'opacity-50 cursor-not-allowed grayscale',
          className
        )}
        title={isListening ? 'Detener' : 'Dictar reporte'}
        aria-label={isListening ? 'Detener grabación de voz' : 'Iniciar grabación de voz'}
        aria-pressed={isListening}
        aria-describedby="voice-status"
      >
        {isProcessing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isListening ? (
          <Square className="size-3 fill-current" />
        ) : mode === 'gemini' ? (
          // AI indicator with sparkle icon
          <div className="relative">
            <Mic className="size-4" />
          </div>
        ) : (
          <Mic className="size-4" />
        )}
      </button>

      {/* Screen reader only status */}
      <div id="voice-status" className="sr-only" role="status" aria-live="polite">
        {isProcessing
          ? 'Procesando audio...'
          : isListening
            ? `Grabando con ${mode === 'gemini' ? 'IA' : 'método nativo'}`
            : 'Listo para grabar'}
      </div>
    </div>
  );
}
