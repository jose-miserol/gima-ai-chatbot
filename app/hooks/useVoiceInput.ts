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

// Get SpeechRecognition constructor
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
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    const hasMediaRecorder =
      typeof window !== "undefined" && !!window.MediaRecorder;
    const hasSpeechRecognition = !!getSpeechRecognition();

    setIsSupported(hasMediaRecorder || hasSpeechRecognition);

    // Prefer Gemini (MediaRecorder) if available
    if (hasMediaRecorder) {
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

      // Determine best mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";

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

        // Convert audio to base64
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          console.log("[Voice] Audio base64 length:", base64Audio.length);
          console.log("[Voice] Audio prefix:", base64Audio.substring(0, 50));
          
          try {
            console.log("[Voice] Calling transcribeAudio...");
            const result = await transcribeAudio(base64Audio);
            console.log("[Voice] transcribeAudio result:", result);

            if (result.success && result.text) {
              setTranscript(result.text);
              onTranscript?.(result.text);
              setError(null);
            } else {
              // FALLBACK: If Gemini fails, switch to native
              const errorMsg = result.error || "Error con Gemini. Cambiando a modo local...";
              console.error("[Voice] Gemini error:", errorMsg);
              setError(errorMsg);
              onError?.(errorMsg);
              setMode("native");
            }
          } catch (err: any) {
            console.error("[Voice] Exception calling transcribeAudio:", err);
            const errorMsg = err?.message || "Error inesperado con Gemini";
            setError(errorMsg);
            onError?.(errorMsg);
            setMode("native");
          }

          setIsProcessing(false);
          onStateChange?.("idle");

          // Stop stream tracks
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
      console.error("Error starting Gemini recording:", err);
      setError("No se pudo grabar. Cambiando a modo básico.");
      onError?.("No se pudo grabar. Cambiando a modo básico.");
      setMode("native");
      // Try native immediately
      startNativeListening();
    }
  }, [onTranscript, onError, onStateChange]);

  const stopGeminiRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // --- NATIVE Logic (Web Speech API) ---
  const startNativeListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setError("Reconocimiento de voz no soportado en este navegador.");
      onError?.("Reconocimiento de voz no soportado en este navegador.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      onStateChange?.("listening");
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          currentTranscript += result[0].transcript;
        }
      }
      if (currentTranscript) {
        setTranscript((prev) => {
          const newText = prev ? prev + " " + currentTranscript : currentTranscript;
          onTranscript?.(newText);
          return newText;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Native speech error:", event.error);
      if (event.error !== "aborted") {
        setError(`Error de voz: ${event.error}`);
        onError?.(`Error de voz: ${event.error}`);
      }
      setIsListening(false);
      onStateChange?.("idle");
    };

    recognition.onend = () => {
      setIsListening(false);
      onStateChange?.("idle");
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Error starting native recognition:", e);
      setError("Error al iniciar reconocimiento de voz.");
      onError?.("Error al iniciar reconocimiento de voz.");
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
    if (isProcessing) return; // Don't toggle while processing

    if (isListening) {
      if (mode === "gemini") {
        stopGeminiRecording();
      } else {
        stopNativeListening();
      }
    } else {
      setTranscript(""); // Reset transcript on new recording
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
