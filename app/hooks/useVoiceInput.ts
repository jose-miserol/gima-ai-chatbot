"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { transcribeAudio } from "@/app/actions";

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: "listening" | "processing" | "idle") => void;
  language?: string;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  isSupported: boolean;
  mode: "gemini" | "native";
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

// Web Speech API Type Definitions (Local Interfaces to avoid global conflicts)
interface ISpeechRecognitionEvent extends Event {
  results: ISpeechRecognitionResultList;
  resultIndex: number;
  error: any;
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
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

// Simplify technical Gemini errors to user-friendly messages
const simplifyGeminiError = (error?: string): string => {
  if (!error) return "🎤 Modo local activo";
  const lowerError = error.toLowerCase();
  console.log(lowerError);
  
  // Quota/Rate limit errors
  if (lowerError.includes("quota") || lowerError.includes("exceeded") || lowerError.includes("rate limit")) {
    return "⚡ Cuota agotada · Modo local activo";
  }
  // API key errors
  if (lowerError.includes("api key") || lowerError.includes("api_key") || lowerError.includes("invalid key")) {
    return "🔑 API sin configurar · Modo local activo";
  }
  // Network errors
  if (lowerError.includes("network") || lowerError.includes("fetch") || lowerError.includes("connection")) {
    return "📡 Sin conexión · Modo local activo";
  }
  // Timeout errors
  if (lowerError.includes("timeout")) {
    return "⏱️ Tiempo agotado · Modo local activo";
  }
  // Audio/media errors
  if (lowerError.includes("audio") || lowerError.includes("media") || lowerError.includes("format")) {
    return "🔊 Error de audio · Modo local activo";
  }
  // Generic server errors
  if (lowerError.includes("500") || lowerError.includes("server error") || lowerError.includes("internal")) {
    return "⚠️ Error de servidor · Modo local activo";
  }
  if (lowerError.includes("models/") && (lowerError.includes("not found") || lowerError.includes("is not"))) {
    return "🤖 Modelo no disponible · Modo local activo";
  }
  
  // Show partial error for debugging (first 30 chars)
  const shortError = error.length > 30 ? error.substring(0, 30) + "..." : error;
  return `⚠️ ${shortError} · Modo local activo`;
};

export function useVoiceInput({
  onTranscript,
  onError,
  onStateChange,
  language = "es-ES",
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"gemini" | "native">("gemini");
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    const hasMediaRecorder =
      typeof window !== "undefined" && !!window.MediaRecorder;
    const hasSpeechRecognition = !!getSpeechRecognition();

    setIsSupported(hasMediaRecorder || hasSpeechRecognition);

    // Prefer Gemini if available AND online
    if (hasMediaRecorder && navigator.onLine) {
      setMode("gemini");
    } else if (hasSpeechRecognition) {
      setMode("native");
    }
  }, []);

  // --- GEMINI Logic (MediaRecorder) ---
  const startGeminiRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);
        onStateChange?.("processing");

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          try {
            const result = await transcribeAudio(base64Audio);

            if (result.success && result.text) {
              setTranscript(result.text);
              onTranscript?.(result.text);
              setError(null);
            } else {
              throw new Error(result.error || "Error desconocido");
            }
          } catch (err: any) {
            const hasSpeechRecognition = !!getSpeechRecognition();

            if (hasSpeechRecognition) {
              const userFriendlyError = simplifyGeminiError(err?.message);
              setError(userFriendlyError);
              onError?.(userFriendlyError);
              setMode("native");
            } else {
              const errorMsg = "🌐 Navegador sin soporte de voz · Usa Chrome o Edge";
              setError(errorMsg);
              onError?.(errorMsg);
            }
          }

          setIsProcessing(false);
          onStateChange?.("idle");
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        };

        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsListening(true);
      onStateChange?.("listening");
      setError(null);
    } catch (err) {
      setMode("native");
      startNativeListening();
    }
  }, [onTranscript, onError, onStateChange]);

  const stopGeminiRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // --- NATIVE Logic (Web Speech API) ---
  const startNativeListening = useCallback(() => {
    setError(null);
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      const errorMsg = "🌐 Navegador sin soporte de voz · Usa Chrome o Edge";
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
      onStateChange?.("listening");
      setError(null);
    };

    // Improved: Rebuild transcript from scratch to avoid duplicates
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let fullTranscript = "";
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
      if (event.error === "no-speech") return;

      if (event.error === "not-allowed") {
        setError("🎤 Permiso de micrófono denegado");
        onError?.("🎤 Permiso de micrófono denegado");
      } else if (event.error !== "aborted") {
        if (!didStart) {
          const errorMsg = "🌐 Navegador sin soporte de voz · Usa Chrome o Edge";
          setError(errorMsg);
          onError?.(errorMsg);
        } else {
          setError(`⚠️ Error de voz: ${event.error}`);
          onError?.(`⚠️ Error de voz: ${event.error}`);
        }
      }
      setIsListening(false);
      onStateChange?.("idle");
    };

    recognition.onend = () => {
      if (!didStart) {
        const errorMsg = "🌐 Navegador sin soporte de voz · Usa Chrome o Edge";
        setError(errorMsg);
        onError?.(errorMsg);
      }
      setIsListening(false);
      onStateChange?.("idle");
    };

    try {
      recognition.start();
    } catch (e) {
      const errorMsg = "🌐 Navegador sin soporte de voz · Usa Chrome o Edge";
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
      if (mode === "gemini") {
        stopGeminiRecording();
      } else {
        stopNativeListening();
      }
    } else {
      setTranscript("");
      if (mode === "gemini") {
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

  const resetTranscript = useCallback(() => setTranscript(""), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== "inactive") {
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
