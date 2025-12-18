"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface VoiceButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({
  isListening,
  isSupported,
  onClick,
  disabled = false,
  className,
}: VoiceButtonProps) {
  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-full p-2 transition-all duration-200",
        isListening
          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      title={isListening ? "Detener dictado" : "Dictar por voz"}
      aria-label={isListening ? "Detener dictado" : "Dictar por voz"}
    >
      {isListening ? (
        <MicOff className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
