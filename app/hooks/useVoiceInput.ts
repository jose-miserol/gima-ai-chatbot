"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  language?: string;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

// Get SpeechRecognition constructor (browser-specific)
const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

export function useVoiceInput({
  onTranscript,
  onError,
  continuous = true,
  language = "es-ES",
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Check support on mount
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(async () => {
    // First, request microphone permission explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed the permission
      stream.getTracks().forEach(track => track.stop());
    } catch {
      const errorMsg = "Permiso de micrófono denegado. Por favor, permite el acceso al micrófono.";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    
    if (!SpeechRecognition) {
      const errorMsg = "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.";
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }

    try {
      // Create new instance
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Configure
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      // Event handlers
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        
        if (currentTranscript) {
          setTranscript(currentTranscript);
          onTranscript?.(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        const errorMessages: Record<string, string> = {
          "no-speech": "No se detectó voz. Intenta hablar más fuerte.",
          "audio-capture": "No se pudo capturar audio. Verifica tu micrófono.",
          "not-allowed": "Permiso de micrófono denegado.",
          "network": "Error de red. Verifica tu conexión a internet.",
          "aborted": "Reconocimiento cancelado.",
          "service-not-allowed": "Servicio de reconocimiento no permitido.",
        };
        const errorMsg = errorMessages[event.error] || `Error de voz: ${event.error}`;
        setError(errorMsg);
        onError?.(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      // Start listening
      recognition.start();
      
    } catch (err) {
      const errorMsg = "Error al iniciar reconocimiento de voz.";
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [continuous, language, onTranscript, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
}
