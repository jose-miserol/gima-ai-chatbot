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

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
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

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Stop listening if voice is active
    if (isListening) {
      toggleListening();
    }

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

            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Voice Status Indicators */}
        <div className="min-h-[28px] flex items-center justify-center text-sm gap-2">
          {voiceError && (
            <span className="text-red-500 text-xs">{voiceError}</span>
          )}
          {isListening && (
            <span
              className={
                mode === "gemini"
                  ? "text-blue-500 animate-pulse"
                  : "text-red-500 animate-pulse"
              }
            >
              {mode === "gemini"
                ? "🎤 Grabando para IA..."
                : "🎤 Escuchando (modo local)..."}
            </span>
          )}
          {isProcessing && (
            <span className="text-blue-600 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Procesando con IA...
            </span>
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
