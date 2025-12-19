"use client";

import {
  Conversation,
  ConversationContent,
} from "@/app/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/app/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/app/components/ai-elements/prompt-input";
import { Loader } from "@/app/components/ai-elements/loader";
import { useVoiceInput } from "@/app/hooks/useVoiceInput";
import { useState, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { 
  CopyIcon, 
  Loader2, 
  Bot, 
  MoreVertical, 
  Info, 
  PlusCircle, 
  Send,
  Bolt,
  QrCode,
  ScanBarcode,
  Camera,
  Mic,
  MicOff,
  Square,
  Trash2
} from "lucide-react";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/app/config";

// --- STARTER PROMPTS ---
const STARTER_PROMPTS = [
  {
    title: "Crear Reporte",
    text: "Crear Reporte: ",
    icon: Bolt,
  },
  {
    title: "Escanear activos",
    text: "Abra el escáner para la etiqueta del activo",
    icon: QrCode,
  },
];

export function ChatInterfaceV2() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use regular useChat (no persistence)
  const { messages, sendMessage, status, setMessages } = useChat();
  const isLoaded = true;
  
  const clearHistory = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

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

  const {
    isListening,
    isProcessing,
    isSupported,
    mode,
    toggleListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: (text) => updateTextareaValue(text),
  });

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) return;
    if (isListening) toggleListening();

    sendMessage(
      { text: message.text || "Archivo adjunto", files: message.files },
      { body: { model: model } }
    );
    setInput("");
  };

  // Show loading state while history is being restored
  if (!isLoaded) {
    return (
      <div className="flex flex-col h-screen w-full bg-white items-center justify-center">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white text-slate-900 font-sans">
      
      {/* --- HEADER --- */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white z-20">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[#2c3e50] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Bot className="size-6" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight text-slate-800">
              GIMA Assistant
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs text-slate-500 font-medium">Online</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <Loader2 className="size-3 animate-spin" />
            </span>
          )}
          {messages.length > 0 && (
            <button 
              onClick={() => {
                if (confirm('¿Borrar todo el historial?')) {
                  clearHistory();
                  setInput('');
                }
              }}
              title="Borrar historial"
              className="size-10 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button className="size-10 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 transition-colors">
            <MoreVertical className="size-5" />
          </button>
        </div>
      </header>

      {/* --- CHAT AREA --- */}
      <div className="flex-1 overflow-hidden bg-white relative">
        <Conversation className="h-full">
          <ConversationContent className="px-4 py-6 space-y-6">
            
            {/* Separador TODAY */}
            <div className="flex justify-center mb-6">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                Today
              </span>
            </div>

            {/* EMPTY STATE */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-[#2c3e50]">
                  <Bot className="size-6" />
                </div>
                <p className="text-slate-600 text-sm text-center max-w-xs mb-6">
                  ¡Hola! Estoy listo para ayudarte con tus tareas de mantenimiento. ¿Qué te gustaría revisar?
                </p>
                <div className="flex gap-2">
                  {STARTER_PROMPTS.map((prompt, i) => (
                    <button 
                      key={i}
                      onClick={() => updateTextareaValue(prompt.text)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors text-[#2c3e50] flex items-center gap-1.5 shadow-sm"
                    >
                      <prompt.icon className="size-3.5" />
                      {prompt.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MENSAJES */}
            {messages.map((message) => (
              <div key={message.id} className="w-full">
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    const isUser = message.role === "user";
                    return (
                      <div key={`${message.id}-${i}`} className={`flex gap-3 mb-6 ${isUser ? 'justify-end' : ''}`}>
                        
                        {/* Avatar IA */}
                        {!isUser && (
                          <div className="size-8 shrink-0 flex items-center justify-center text-[#2c3e50]/90 self-start mt-1">
                            <Bot className="size-5" />
                          </div>
                        )}

                        <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                          <Message from={message.role} className="block w-full">
                            <MessageContent
                              className={`
                                p-3.5 rounded-xl text-sm leading-relaxed shadow-sm border
                                ${isUser 
                                  ? "bg-[#EEF1F6] text-[#1E293B] rounded-tr-none border-transparent"
                                  : "bg-[#F9FAFB] text-slate-700 rounded-tl-none border-slate-200"
                                }
                              `}
                            >
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                          
                          {/* Timestamp */}
                          <div className="flex items-center gap-2 mt-0.5 px-1">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            {!isUser && (
                              <button 
                                onClick={() => navigator.clipboard.writeText(part.text)} 
                                className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <CopyIcon className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
        </Conversation>
      </div>

      {/* Notification/Error Messages - Floating above footer */}
      {voiceError && !isListening && (
        <div className="px-4 pb-2 flex justify-center">
          <div className={`w-full sm:w-auto sm:min-w-[400px] sm:max-w-[600px] px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-2 duration-300 ${
            voiceError.includes("Error") || voiceError.includes("error")
              ? "bg-red-50 border border-red-200 text-red-700"
              : voiceError.includes("Cuota") || voiceError.includes("agotad")
              ? "bg-orange-50 border border-orange-200 text-orange-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
          }`}>
            <span className="text-base">{voiceError.split(" ")[0]}</span>
            <span className="flex-1">{voiceError.split(" ").slice(1).join(" ")}</span>
            <span className="text-xs opacity-60 hidden sm:inline">Tap mic to retry</span>
          </div>
        </div>
      )}

      {/* Listening Status Indicator */}
      {isListening && (
        <div className="px-4 pb-2 flex justify-center">
          <div className={`w-full sm:w-auto sm:min-w-[300px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-2 duration-300 ${
            mode === "gemini"
              ? "bg-blue-50 border border-blue-200 text-blue-700"
              : "bg-slate-50 border border-slate-200 text-slate-700"
          }`}>
            <span className="relative flex size-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                mode === "gemini" ? "bg-blue-400" : "bg-red-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full size-3 ${
                mode === "gemini" ? "bg-blue-500" : "bg-red-500"
              }`}></span>
            </span>
            <span>{mode === "gemini" ? "🎤 Escuchando (IA)..." : "🎤 Grabando (local)..."}</span>
            <span className="text-xs opacity-60">Toca stop para finalizar</span>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="px-4 pb-2 flex justify-center">
          <div className="w-full sm:w-auto sm:min-w-[300px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-3 text-sm font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 animate-in slide-in-from-bottom-2 duration-300">
            <Loader2 className="size-4 animate-spin" />
            <span>Procesando audio...</span>
          </div>
        </div>
      )}

      {/* --- FOOTER / INPUT AREA --- */}
      <footer className="shrink-0 bg-white border-t border-slate-200 p-4 pb-6 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">

        {/* Fila Superior: Scan / Photo / Voice - FUERA del form */}
        <div className="flex items-center gap-3 mb-3 overflow-x-auto pb-1">
          
          {/* Scan Button */}
          <div className="flex flex-col items-center gap-1.5 min-w-[3.5rem]">
            <button 
              type="button"
              className="size-11 rounded-full border bg-slate-50 border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-[#2c3e50] transition-colors"
            >
              <ScanBarcode className="size-5" />
            </button>
            <span className="text-[10px] font-medium text-slate-500">Scan</span>
          </div>

          {/* Photo Button */}
          <div className="flex flex-col items-center gap-1.5 min-w-[3.5rem]">
            <button 
              type="button"
              className="size-11 rounded-full border bg-slate-50 border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100 hover:text-[#2c3e50] transition-colors"
            >
              <Camera className="size-5" />
            </button>
            <span className="text-[10px] font-medium text-slate-500">Photo</span>
          </div>

          {/* Voice Button */}
          {isSupported && (
            <div className="flex flex-col items-center gap-1.5 min-w-[3.5rem]">
              <button
                type="button"
                onClick={toggleListening}
                disabled={isProcessing}
                className={`size-11 rounded-full border flex items-center justify-center transition-all ${
                  isListening 
                    ? "bg-red-50 border-red-200 text-red-500 animate-pulse" 
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-[#2c3e50]"
                } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
              >
                {isProcessing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : isListening ? (
                  <Square className="size-4 fill-current" />
                ) : (
                  <Mic className="size-5" />
                )}
              </button>
              <span className="text-[10px] font-medium text-slate-500">
                {isListening ? "Stop" : "Voice"}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 mx-1"></div>

          {/* Info */}
          <div className="flex-1 flex items-center gap-2 px-2">
            <Info className="text-slate-400 size-4 shrink-0" />
            <p className="text-xs text-slate-500 line-clamp-1">
              <span className="text-[#2c3e50] font-medium">Options</span> for quick lookup
            </p>
          </div>
        </div>

        {/* Fila Inferior: Input + Send - DENTRO del form */}
        <PromptInput onSubmit={handleSubmit} globalDrop multiple>
          {/* Hidden Model Selector */}
          <PromptInputTools className="hidden">
            <PromptInputSelect onValueChange={setModel} value={model}>
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

          <div className="flex items-center gap-3 w-full">
            {/* Plus Button - Aligned center */}
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger className="size-12 shrink-0 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-[#2c3e50] hover:bg-slate-200 hover:border-slate-300 flex items-center justify-center transition-all">
                <PlusCircle className="size-6" />
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>

            {/* Input Container - Larger */}
            <PromptInputBody className="flex-1 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-[#2c3e50] focus-within:ring-2 focus-within:ring-[#2c3e50]/20 focus-within:bg-white transition-all shadow-sm">
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type command..."
                className="w-full bg-transparent border-none text-slate-900 placeholder:text-slate-400 text-base py-4 px-4 focus:ring-0 resize-none max-h-40 leading-relaxed min-h-[56px]"
              />
            </PromptInputBody>

            {/* Send Button - Aligned center */}
            <PromptInputSubmit
              disabled={!input || status !== "ready"}
              status={status}
              className="size-12 shrink-0 rounded-xl bg-[#2c3e50] text-white flex items-center justify-center hover:bg-[#1a252f] active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Send className="size-5" />
            </PromptInputSubmit>
          </div>
        </PromptInput>
      </footer>
    </div>
  );
}
