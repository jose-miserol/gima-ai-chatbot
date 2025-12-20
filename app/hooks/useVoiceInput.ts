'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { transcribeAudio } from '@/app/actions';
import { logger } from '@/app/lib/logger';
import { VOICE_MESSAGES, MAX_ERROR_MESSAGE_LENGTH } from '@/app/constants/messages';

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: 'listening' | 'processing' | 'idle') => void;
  language?: string;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  isSupported: boolean;
  mode: 'gemini' | 'native';
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

// Web Speech API Type Definitions (Local Interfaces to avoid global conflicts)
interface ISpeechRecognitionEvent extends Event {
  results: ISpeechRecognitionResultList;
  resultIndex: number;
}

interface ISpeechRecognitionResultList {
  length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  onerror: (event: ISpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

// Get SpeechRecognition constructor safely
const getSpeechRecognition = (): ISpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

// Simplify technical Gemini errors to user-friendly messages
const simplifyGeminiError = (error?: string): string => {
  if (!error) return VOICE_MESSAGES.LOCAL_MODE;
  const lowerError = error.toLowerCase();

  logger.debug('Gemini transcription error', { error: lowerError, component: 'useVoiceInput' });

  // Quota/Rate limit errors
  if (
    lowerError.includes('quota') ||
    lowerError.includes('exceeded') ||
    lowerError.includes('rate limit')
  ) {
    return VOICE_MESSAGES.QUOTA_EXCEEDED;
  }
  // API key errors
  if (
    lowerError.includes('api key') ||
    lowerError.includes('api_key') ||
    lowerError.includes('invalid key')
  ) {
    return VOICE_MESSAGES.API_NOT_CONFIGURED;
  }
  // Network errors
  if (
    lowerError.includes('network') ||
    lowerError.includes('fetch') ||
    lowerError.includes('connection')
  ) {
    return VOICE_MESSAGES.NO_CONNECTION;
  }
  // Timeout errors
  if (lowerError.includes('timeout')) {
    return VOICE_MESSAGES.TIMEOUT;
  }
  // Audio/media errors
  if (
    lowerError.includes('audio') ||
    lowerError.includes('media') ||
    lowerError.includes('format')
  ) {
    return VOICE_MESSAGES.AUDIO_ERROR;
  }
  // Generic server errors
  if (
    lowerError.includes('500') ||
    lowerError.includes('server error') ||
    lowerError.includes('internal')
  ) {
    return VOICE_MESSAGES.SERVER_ERROR;
  }
  if (
    lowerError.includes('models/') &&
    (lowerError.includes('not found') || lowerError.includes('is not'))
  ) {
    return VOICE_MESSAGES.MODEL_NOT_AVAILABLE;
  }

  // Show partial error for debugging
  const shortError =
    error.length > MAX_ERROR_MESSAGE_LENGTH
      ? error.substring(0, MAX_ERROR_MESSAGE_LENGTH) + '...'
      : error;
  return `⚠️ ${shortError} · Modo local activo`;
};

/**
 * Hook para manejar entrada de voz multimodal.
 * Prioriza el uso de la API de Gemini (Server-side) para mayor precisión,
 * pero hace fallback automático a Web Speech API (Nativo) si falla o no hay internet.
 *
 * @param options - Opciones de callbacks y configuración
 * @returns Estado y controles del reconocimiento de voz
 */
export function useVoiceInput({
  onTranscript,
  onError,
  onStateChange,
  language = 'es-ES',
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'gemini' | 'native'>('gemini');
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    const hasMediaRecorder = typeof window !== 'undefined' && !!window.MediaRecorder;
    const hasSpeechRecognition = !!getSpeechRecognition();

    setIsSupported(hasMediaRecorder || hasSpeechRecognition);

    // Prefer Gemini if available AND online
    if (hasMediaRecorder && navigator.onLine) {
      setMode('gemini');
    } else if (hasSpeechRecognition) {
      setMode('native');
    }
  }, []);

  // --- GEMINI Logic (MediaRecorder) ---
  const startGeminiRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);
        onStateChange?.('processing');

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          try {
            // Create new AbortController for this request
            abortControllerRef.current = new AbortController();

            const result = await transcribeAudio(base64Audio);

            // Check if aborted
            if (abortControllerRef.current?.signal.aborted) {
              logger.debug('Transcription cancelled by user', { component: 'useVoiceInput' });
              return;
            }

            if (result.success && result.text) {
              setTranscript(result.text);
              onTranscript?.(result.text);
              setError(null);
            } else {
              throw new Error(result.error || 'Error desconocido');
            }
          } catch (err: unknown) {
            const hasSpeechRecognition = !!getSpeechRecognition();

            if (hasSpeechRecognition) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              const userFriendlyError = simplifyGeminiError(errorMessage);
              setError(userFriendlyError);
              onError?.(userFriendlyError);
              setMode('native');
            } else {
              const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
              setError(errorMsg);
              onError?.(errorMsg);
            }
          }

          setIsProcessing(false);
          onStateChange?.('idle');
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        };

        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsListening(true);
      onStateChange?.('listening');
      setError(null);
    } catch (err) {
      setMode('native');
      startNativeListening();
    }
  }, [onTranscript, onError, onStateChange]);

  const stopGeminiRecording = useCallback(() => {
    // Cancel any pending transcription
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // --- NATIVE Logic (Web Speech API) ---
  const startNativeListening = useCallback(() => {
    setError(null);
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    let didStart = false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      didStart = true;
      setIsListening(true);
      onStateChange?.('listening');
      setError(null);
    };

    // Improved: Rebuild transcript from scratch to avoid duplicates
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += event.results[i][0].transcript;
        } else {
          // Include interim for real-time feel
          fullTranscript += event.results[i][0].transcript;
        }
      }
      if (fullTranscript) {
        setTranscript(fullTranscript);
        onTranscript?.(fullTranscript);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      // Ignore 'no-speech' which fires randomly
      if (event.error === 'no-speech') return;

      if (event.error === 'not-allowed') {
        setError(VOICE_MESSAGES.PERMISSION_DENIED);
        onError?.(VOICE_MESSAGES.PERMISSION_DENIED);
      } else if (event.error !== 'aborted') {
        if (!didStart) {
          const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
          setError(errorMsg);
          onError?.(errorMsg);
        } else {
          setError(`${VOICE_MESSAGES.VOICE_ERROR_PREFIX} ${event.error}`);
          onError?.(`${VOICE_MESSAGES.VOICE_ERROR_PREFIX} ${event.error}`);
        }
      }
      setIsListening(false);
      onStateChange?.('idle');
    };

    recognition.onend = () => {
      if (!didStart) {
        const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
        setError(errorMsg);
        onError?.(errorMsg);
      }
      setIsListening(false);
      onStateChange?.('idle');
    };

    try {
      recognition.start();
    } catch (e) {
      const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [language, onTranscript, onError, onStateChange]);

  const stopNativeListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
  }, []);

  // --- Master Control ---
  const toggleListening = useCallback(() => {
    if (isProcessing) return;

    if (isListening) {
      if (mode === 'gemini') {
        stopGeminiRecording();
      } else {
        stopNativeListening();
      }
    } else {
      setTranscript('');
      if (mode === 'gemini') {
        startGeminiRecording();
      } else {
        startNativeListening();
      }
    }
  }, [
    isListening,
    isProcessing,
    mode,
    startGeminiRecording,
    stopGeminiRecording,
    startNativeListening,
    stopNativeListening,
  ]);

  const resetTranscript = useCallback(() => setTranscript(''), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try {
          mediaRecorderRef.current?.stop();
        } catch {
          // Ignore
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    isSupported,
    mode,
    toggleListening,
    resetTranscript,
    error,
  };
}
