"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/app/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/app/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputHeader,
} from "@/app/components/ai-elements/prompt-input";
import { Loader } from "@/app/components/ai-elements/loader";
import { VoiceButton } from "@/app/components/ui/voice-button";
import { useVoiceInput } from "@/app/hooks/useVoiceInput";
import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { CopyIcon, RefreshCcwIcon, Loader2 } from "lucide-react";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/app/config";
import { analyzePartImage } from "@/app/actions";

export function ChatInterfaceV1() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [visionResponse, setVisionResponse] = useState<{id: string; text: string} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, regenerate } = useChat();

  // Update textarea value programmatically
  const updateTextareaValue = useCallback((value: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeInputValueSetter?.call(textarea, value);
      const event = new Event("input", { bubbles: true });
      textarea.dispatchEvent(event);
    }
    setInput(value);
  }, []);

  // Voice input with Gemini + native fallback
  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: (text) => {
      // Append or replace based on mode
      if (mode === "gemini") {
        // Gemini returns full text at once
        updateTextareaValue(text);
      } else {
        // Native returns incrementally
        updateTextareaValue(text);
      }
    },
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Stop listening if voice is active
    if (isListening) {
      toggleListening();
    }

    // Check if there's an image attachment for auto-inventory analysis
    const imageFile = message.files?.find(file => 
      file.mediaType?.startsWith('image/')
    );

    // If image attached with minimal/no text, use Gemini for vision analysis
    if (imageFile && imageFile.url && (!hasText || (message.text?.trim().length || 0) < 10)) {
      setIsAnalyzingImage(true);
      
      try {
        // Fetch blob URL and convert to base64
        const response = await fetch(imageFile.url);
        const blob = await response.blob();
        
        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        const imageDataUrl = await base64Promise;
        
        // Call Gemini vision via server action
        const result = await analyzePartImage(imageDataUrl, imageFile.mediaType || 'image/jpeg');
        
        if (result.success && result.text) {
          // Store vision result to display as assistant message
          setVisionResponse({
            id: `vision-${Date.now()}`,
            text: result.text
          });
        } else {
          // If vision fails, show error as vision response
          setVisionResponse({
            id: `vision-error-${Date.now()}`,
            text: `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`
          });
        }
      } catch (error: any) {
        console.error('Error processing image:', error);
        setVisionResponse({
          id: `vision-error-${Date.now()}`,
          text: `❌ Error al procesar imagen: ${error.message}`
        });
      } finally {
        setIsAnalyzingImage(false);
      }
      
      setInput("");
      return;
    }

    // Normal text message - use GROQ
    sendMessage(
      {
        text: message.text || "Archivo adjunto",
        files: message.files,
      },
      {
        body: {
          model: model,
        },
      }
    );

    setInput("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            GIMA Chatbot
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Asistente Inteligente de Mantenimiento - UNEG
          </p>
        </div>

        {/* Conversation Area */}
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">
                    👋 ¡Hola! Soy tu asistente de mantenimiento
                  </p>
                  <p className="text-sm">
                    Pregúntame sobre equipos, procedimientos o solicita ayuda
                  </p>
                  {isSupported && (
                    <p className="text-xs mt-2 text-gray-400">
                      🎤 Puedes usar el micrófono para dictar
                      {mode === "gemini" && " (con IA)"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                        {message.role === "assistant" &&
                          i === message.parts.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                onClick={() => regenerate()}
                                label="Reintentar"
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copiar"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                      </Message>
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            {/* Vision Analysis Response - displayed as assistant message */}
            {visionResponse && (
              <Message from="assistant">
                <MessageContent>
                  <MessageResponse>{`📷 **Análisis de Inventario**\n\n${visionResponse.text}`}</MessageResponse>
                </MessageContent>
                <MessageActions>
                  <MessageAction
                    onClick={() => navigator.clipboard.writeText(visionResponse.text)}
                    label="Copiar"
                  >
                    <CopyIcon className="size-3" />
                  </MessageAction>
                  <MessageAction
                    onClick={() => setVisionResponse(null)}
                    label="Cerrar"
                  >
                    ✕
                  </MessageAction>
                </MessageActions>
              </Message>
            )}

            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Voice Status Indicators */}
        <div className="min-h-[36px] flex items-center justify-center">
          {voiceError && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
              <span>{voiceError}</span>
            </div>
          )}
          {isListening && !voiceError && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                mode === "gemini"
                  ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                  : "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              <span className="relative flex size-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mode === "gemini" ? "bg-blue-400" : "bg-gray-400"}`}></span>
                <span className={`relative inline-flex rounded-full size-2 ${mode === "gemini" ? "bg-blue-500" : "bg-gray-500"}`}></span>
              </span>
              {mode === "gemini"
                ? "Grabando para IA..."
                : "Escuchando..."}
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
        </div>

        {/* Input Area */}
        <PromptInput
          onSubmit={handleSubmit}
          className="mt-2"
          globalDrop
          multiple
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>

          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta sobre mantenimiento..."
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              {/* Voice Button */}
              <VoiceButton
                isListening={isListening}
                isProcessing={isProcessing}
                isSupported={isSupported}
                mode={mode}
                onClick={toggleListening}
                disabled={status !== "ready" || isProcessing}
              />

              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {AVAILABLE_MODELS.map((m) => (
                    <PromptInputSelectItem key={m.value} value={m.value}>
                      {m.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>

            <PromptInputSubmit
              disabled={!input || status !== "ready"}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
