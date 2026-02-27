# 13 — Feature: Chat Principal (`features/chat/`)

> El módulo más grande del proyecto. Contiene 14 archivos + 5 hooks + 5 archivos de tipos. Es la interfaz completa del chat con IA.

---

## 📄 `chat.tsx` — El Orquestador (~363 líneas)

Representa el masivo componente central u orquestador raíz donde cohabitan e interactúan armónicamente todas las piezas fundamentales de la vista: el encabezado superior, el historial de conversación continuo, el complejo campo de entrada de texto, los módulos de voz incrustados y los motores de comandos contextuales. Su enorme tamaño y densidad de código radican en su misión vital de coordinar asíncronamente aproximadamente 10 subsistemas dispares (incluyendo el envío de chat, la transcripción de audio, el procesamiento de archivos adjuntos, el análisis de comandos y el registro general de atajos de teclado del usuario) dentro de un único contexto reactivo unificado.

### Integraciones que Maneja

```typescript
// Estado de chat con persistencia
const { messages, sendMessage, status, clearHistory, setMessages, addToolOutput }
  = usePersistentChat({ storageKey: 'gima-chat-v1', enablePersistence: true });

// Voz
const { isListening, isProcessing, isSupported, toggleListening }
  = useVoiceInput({ onTranscript: updateTextareaValue });

// Archivos (imágenes y PDFs)
const { handleSubmit, isAnalyzing, analyzingFileType }
  = useFileSubmission({ setMessages, sendMessage, isListening, toggleListening });

// Acciones del chat (regenerar, limpiar, copiar)
const { handleRegenerate, handleClear, handleCopyMessage }
  = useChatActions({ regenerate, clearHistory, setInput });

// Atajos de teclado
useChatKeyboard({ onSubmit: ..., onCancelVoice: ..., onFocusInput: ... });
```

### Estructura Visual del Componente

```
┌─────────────────────────────────────┐
│ ChatHeader                          │  ← Título + selector modelo + acciones
├─────────────────────────────────────┤
│                                     │
│ ChatConversation                    │  ← Lista de mensajes con scroll
│   ├── ChatMessage (user)            │
│   ├── ChatMessage (assistant)       │
│   ├── ChatMessage (user)            │
│   └── Skeleton (si cargando)        │
│                                     │
├─────────────────────────────────────┤
│ ChatStatusIndicators                │  ← "Grabando...", "Analizando imagen..."
├─────────────────────────────────────┤
│ VoiceCommandMode (si activo)        │  ← Modo comando de voz
├─────────────────────────────────────┤
│ ChatInputArea                       │  ← Textarea + botones
│   ├── Textarea                      │
│   ├── 📎 Adjuntar                   │
│   ├── 🎤 Voz                        │
│   └── ➤ Enviar                      │
└─────────────────────────────────────┘
```

### Detección Automática de Comandos de Voz

```typescript
useEffect(() => {
  // Cuando termina de grabar, verificar si dijo un comando
  if ((isGeminiFinish || isNativeFinish) && transcript.trim().length > 5) {
    const result = await executeVoiceCommand(transcript, { minConfidence: 0.6 });
    if (result.success && result.command) {
      setDetectedCommand(result.command); // ← Muestra alerta para confirmar
    }
  }
}, [isListening, isProcessing, transcript]);
```

💡 **¿Cómo funciona?** Cada vez que el usuario termina de hablar, se verifica silenciosamente si lo que dijo es un comando de orden de trabajo. Si lo es, aparece un popup preguntando si quiere ejecutarlo.

---

## 📄 Archivos de la Interfaz del Chat

| Archivo                     | ¿Para qué?                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `chat-header.tsx`           | Barra superior: logo GIMA, selector de modelo, botón "borrar historial"                 |
| `chat-conversation.tsx`     | Contenedor de mensajes con auto-scroll al fondo y skeleton loading                      |
| `chat-message.tsx`          | Mensaje individual: avatar, markdown renderizado, botones de acción (copiar, regenerar) |
| `chat-input-area.tsx`       | Área de input: textarea, botón voz, adjuntar archivo, enviar                            |
| `chat-empty-state.tsx`      | Lo que ves cuando no hay mensajes: sugerencias de preguntas                             |
| `chat-quick-actions.tsx`    | Chips de acciones rápidas (preguntas precargadas)                                       |
| `chat-status-bar.tsx`       | Indicadores: "Grabando voz...", "Analizando imagen...", errores                         |
| `chat-message-skeleton.tsx` | Skeleton animado con forma de mensaje (para loading)                                    |
| `tool-result-cards.tsx`     | Tarjetas para mostrar resultados de tool calls (Generative UI)                          |
| `constants.ts`              | Constantes: mensajes, timeouts, límites visuales                                        |
| `utils.ts`                  | Utilidades internas del chat                                                            |
| `index.ts`                  | Re-exporta `Chat` y tipos públicos                                                      |

---

## 📁 `hooks/` — Hooks del Chat

| Hook                     | ¿Para qué?                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `use-chat-actions.ts`    | Acciones del menú: copiar mensaje, regenerar último, limpiar historial               |
| `use-chat-keyboard.ts`   | Atajos: Enter envía, Shift+Enter nueva línea, Escape cancela voz                     |
| `use-chat-submit.ts`     | Lógica de envío: prepara el mensaje, adjunta archivos, llama al API                  |
| `use-file-submission.ts` | Manejo de archivos adjuntos: validación, preview, optimistic update, análisis con IA |
| `use-image-analysis.ts`  | Análisis de imágenes con Gemini Vision                                               |

---

## 📁 `types/` — Tipos del Chat

| Archivo                | ¿Qué define?                                      |
| ---------------------- | ------------------------------------------------- |
| `component.types.ts`   | Props de todos los componentes del chat           |
| `hook.types.ts`        | Tipos de retorno de los hooks                     |
| `message.types.ts`     | Tipos extendidos de mensajes (más allá de AI SDK) |
| `voice-props.types.ts` | Props para componentes de voz                     |

---

**← Anterior**: [12 — AI Elements](./12-componentes-ai-elements.md) | **Siguiente**: [14 — Feature: Voz](./14-feature-voice.md) →
