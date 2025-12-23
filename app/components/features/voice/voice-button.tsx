'use client';

import { forwardRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';
import { AudioWaveform } from './audio-waveform';
import type { VoiceButtonProps as BaseVoiceButtonProps } from './types';
import { VOICE_LABELS } from './constants';

/**
 * Variantes del botón de voz usando CVA para gestión de estilos declarativa y type-safe
 */
const voiceButtonVariants = cva(
  // Base styles applied to all variants
  'relative flex items-center justify-center size-9 rounded-full transition-all duration-300 shadow-sm border focus:outline-none focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      state: {
        idle: 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95',
        listening: '', // Styles determined by compound variants with mode
        processing: 'bg-amber-100 border-amber-200 text-amber-600 cursor-wait animate-pulse',
        disabled: 'opacity-50 cursor-not-allowed grayscale',
      },
      mode: {
        gemini: '',
        native: '',
      },
    },
    compoundVariants: [
      // Listening state with Gemini mode (blue)
      {
        state: 'listening',
        mode: 'gemini',
        className:
          'bg-blue-600 border-blue-600 text-white shadow-blue-200 dark:shadow-blue-900/50 ring-2 ring-blue-200 dark:ring-blue-800',
      },
      // Listening state with native mode (gray)
      {
        state: 'listening',
        mode: 'native',
        className: 'bg-gray-500 border-gray-500 text-white shadow-gray-200 ring-2 ring-gray-200',
      },
    ],
    defaultVariants: {
      state: 'idle',
      mode: 'native',
    },
  }
);

interface VoiceButtonProps
  extends VariantProps<typeof voiceButtonVariants>, Omit<BaseVoiceButtonProps, 'mode'> {}

export const VoiceButton = forwardRef<HTMLButtonElement, VoiceButtonProps>(
  (
    {
      isListening,
      isProcessing = false,
      isSupported,
      mode = 'native',
      onClick,
      disabled = false,
      className,
    },
    ref
  ) => {
    if (!isSupported) return null;

    // Determine button state based on props
    const state = disabled
      ? 'disabled'
      : isProcessing
        ? 'processing'
        : isListening
          ? 'listening'
          : 'idle';

    // Determine ARIA label dynamically
    const ariaLabel = isListening ? VOICE_LABELS.ariaListening : VOICE_LABELS.ariaIdle;

    // Determine title text
    const title = isListening ? VOICE_LABELS.listening : VOICE_LABELS.idle;

    // Determine status text for screen readers
    const statusText = isProcessing
      ? VOICE_LABELS.processing
      : isListening
        ? `Grabando con ${mode === 'gemini' ? 'IA' : 'método nativo'}`
        : VOICE_LABELS.ready;

    return (
      <div className="flex items-center gap-2">
        {/* Visual indicator when listening (hidden on mobile) */}
        {isListening && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 rounded-full text-blue-600 dark:text-blue-400 text-xs font-medium animate-in fade-in slide-in-from-right-4 duration-300">
            <AudioWaveform active={true} />
            <span>
              {mode === 'gemini' ? VOICE_LABELS.listeningGemini : VOICE_LABELS.listeningNative}
            </span>
          </div>
        )}

        <button
          ref={ref}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(voiceButtonVariants({ state, mode }), className)}
          title={title}
          aria-label={ariaLabel}
          aria-pressed={isListening}
          aria-describedby="voice-status"
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isListening ? (
            <Square className="size-3 fill-current" />
          ) : mode === 'gemini' ? (
            <div className="relative">
              <Mic className="size-4" />
            </div>
          ) : (
            <Mic className="size-4" />
          )}
        </button>

        {/* Screen reader status announcement */}
        <div id="voice-status" className="sr-only" role="status" aria-live="polite">
          {statusText}
        </div>
      </div>
    );
  }
);

VoiceButton.displayName = 'VoiceButton';
