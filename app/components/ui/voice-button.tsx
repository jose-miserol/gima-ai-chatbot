"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface VoiceButtonProps {
  isListening: boolean;
  isProcessing?: boolean;
  isSupported: boolean;
  mode?: "gemini" | "native";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({
  isListening,
  isProcessing = false,
  isSupported,
  mode = "native",
  onClick,
  disabled = false,
  className,
}: VoiceButtonProps) {
  if (!isSupported) {
    return null;
  }

  // Processing state - show loader
  if (isProcessing) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex items-center justify-center rounded-full p-2",
          "bg-blue-500 text-white cursor-wait",
          className
        )}
        title="Procesando audio..."
        aria-label="Procesando audio"
      >
        <Loader2 className="size-4 animate-spin" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-full p-2 transition-all duration-200",
        isListening
          ? mode === "gemini"
            ? "bg-blue-500 text-white hover:bg-blue-600 animate-pulse"
            : "bg-red-500 text-white hover:bg-red-600 animate-pulse"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      title={
        isListening
          ? "Detener grabación"
          : mode === "gemini"
          ? "Dictar con IA (Gemini)"
          : "Dictar por voz"
      }
      aria-label={isListening ? "Detener grabación" : "Dictar por voz"}
    >
      {isListening ? (
        <MicOff className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
