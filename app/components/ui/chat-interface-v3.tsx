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
import { usePersistentChat } from "@/app/hooks/usePersistentChat";
import { useState, useCallback, useRef, useEffect } from "react";
import { 
  CopyIcon, 
  Loader2, 
  Bot, 
  MoreVertical,
  Bolt,
  QrCode,
  Trash2,
} from "lucide-react";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/app/config";
import { analyzePartImage } from "@/app/actions";

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

export function ChatInterfaceV3() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [showError, setShowError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use persistent chat with localStorage + error handling
  const { 
    messages, 
    sendMessage, 
    status, 
    error: chatError,
    isLoaded,
    visionResponse,
    setVisionResponse,
    clearHistory,
    setMessages
  } = usePersistentChat({ storageKey: 'gima-chat-v3' });
  
  // Show error when chatError occurs, auto-hide after 5 seconds
  useEffect(() => {
    if (chatError) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [chatError]);
  
  // Check if status allows sending (ready, error, or after image analysis)
  // Also allow when status is stuck due to image analysis completing
  const canSend = status === "ready" || status === "error" || (status !== "streaming" && status !== "submitted");

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

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) return;
    if (isListening) toggleListening();

    // Check if there's an image attachment for vision analysis
    const imageFile = message.files?.find(file => 
      file.mediaType?.startsWith('image/')
    );

    // If image attached and no/minimal text, use Gemini vision
    if (imageFile && imageFile.url && (!hasText || (message.text?.trim().length || 0) < 10)) {
      setIsAnalyzingImage(true);
      
      try {
        const response = await fetch(imageFile.url);
        const blob = await response.blob();
        
        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        const imageDataUrl = await base64Promise;
        
        const result = await analyzePartImage(imageDataUrl, imageFile.mediaType || 'image/jpeg');
        
        if (result.success && result.text) {
          const visionId = `vision-${Date.now()}`;
          const analysisText = `📷 **Análisis de Imagen Subida por el Usuario**

He analizado la imagen que el usuario acaba de subir. Este es el resultado del análisis visual:

${result.text}

---
*Este análisis fue generado automáticamente a partir de la imagen subida.*`;
          
          setMessages(prev => [
            ...prev,
            {
              id: visionId,
              role: 'assistant' as const,
              content: analysisText,
              parts: [{ type: 'text' as const, text: analysisText }],
              createdAt: new Date(),
            }
          ]);
          
          setVisionResponse(null);
        } else {
          const errorMsg = `❌ Error al analizar imagen: ${result.error || 'Error desconocido'}`;
          setMessages(prev => [
            ...prev,
            {
              id: `vision-error-${Date.now()}`,
              role: 'assistant' as const,
              content: errorMsg,
              parts: [{ type: 'text' as const, text: errorMsg }],
              createdAt: new Date(),
            }
          ]);
        }
      } catch (error: any) {
        console.error('Error processing image:', error);
        const errorMsg = `❌ Error al procesar imagen: ${error.message}`;
        setMessages(prev => [
          ...prev,
          {
            id: `vision-error-${Date.now()}`,
            role: 'assistant' as const,
            content: errorMsg,
            parts: [{ type: 'text' as const, text: errorMsg }],
            createdAt: new Date(),
          }
        ]);
      } finally {
        setIsAnalyzingImage(false);
      }
      
      setInput("");
      return;
    }

    // Normal text message - use GROQ
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
      
      {/* --- HEADER (V2 Style) --- */}
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

      {/* --- CHAT AREA (V2 Style) --- */}
      <div className="flex-1 overflow-hidden bg-white relative">
        <Conversation className="h-full">
          <ConversationContent className="px-4 py-6 space-y-6">
            
            {/* Separador TODAY */}
            <div className="flex justify-center mb-6">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                Today
              </span>
            </div>

            {/* EMPTY STATE (V2 Style) */}
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

            {/* MENSAJES (V2 Style) */}
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

      {/* --- VOICE STATUS INDICATORS (V1 Style, positioned above input) --- */}
      <div className="min-h-[36px] flex items-center justify-center px-4 bg-white">
        {voiceError && !isListening && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
            <span>{voiceError}</span>
          </div>
        )}
        {isListening && (
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium ${
              mode === "gemini"
                ? "bg-blue-50 border border-blue-200 text-blue-700"
                : "bg-slate-50 border border-slate-200 text-slate-700"
            }`}
          >
            <span className="relative flex size-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mode === "gemini" ? "bg-blue-400" : "bg-red-400"}`}></span>
              <span className={`relative inline-flex rounded-full size-2 ${mode === "gemini" ? "bg-blue-500" : "bg-red-500"}`}></span>
            </span>
            {mode === "gemini" ? "🎤 Grabando para IA..." : "🎤 Escuchando..."}
          </div>
        )}
        {isProcessing && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
            <Loader2 className="size-3 animate-spin" />
            Procesando con IA...
          </div>
        )}
        {isAnalyzingImage && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <Loader2 className="size-3 animate-spin" />
            📷 Analizando imagen...
          </div>
        )}
        {showError && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            ❌ Error de conexión - Intenta de nuevo
          </div>
        )}
      </div>

      {/* --- INPUT AREA (V1 Style Footer) --- */}
      <div className="shrink-0 p-4 pt-2 bg-white border-t border-slate-100">
        <PromptInput
          onSubmit={handleSubmit}
          globalDrop
          multiple
        >
          <PromptInputHeader className="px-2">
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>

          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta sobre mantenimiento..."
              className="min-h-[50px]"
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

              {/* Voice Button (V1 Component) */}
              <VoiceButton
                isListening={isListening}
                isProcessing={isProcessing}
                isSupported={isSupported}
                mode={mode}
                onClick={toggleListening}
                disabled={!canSend || isProcessing}
              />

              <PromptInputSelect
                onValueChange={(value) => setModel(value)}
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
              disabled={!input || !canSend}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
