# 06 — Custom React Hooks

> Los hooks encapsulan lógica de estado compleja y reutilizable. En vez de repetir la misma lógica en múltiples componentes, la extraes a un hook y lo importas donde lo necesites.

---

## 📄 `hooks/use-persistent-chat.ts` — Chat con Persistencia

Es un custom hook especializado que envuelve genialmente el clásico `useChat` proveído por el AI SDK, añadiéndole una robusta capa de persistencia mediante `localStorage`. Sirve para guardar y restaurar el historial completo de la conversación de manera automática, aplicando técnicas avanzadas de compresión (LZString) y un manejo dinámico de la cuota de almacenamiento para no exceder los límites del navegador. Existe porque, por defecto, el estado de React es volátil; sin este hook, recargar la página web o cerrar accidentalmente la pestaña provocaría la pérdida total e irrecuperable de toda la conversación técnica mantenida con la IA.

### ¿Cómo Funciona?

```
                    usePersistentChat
                    ┌─────────────────────────┐
                    │                         │
  useChat (AI SDK)──│── messages, sendMessage  │
                    │                         │
  localStorage ────│── load al montar         │──→ Retorna todo al
                    │── save debounced         │    componente Chat
                    │── compresión lz-string   │
                    │                         │
  Vision state ────│── visionResponse         │
                    └─────────────────────────┘
```

### Líneas Clave

**Carga inicial desde localStorage**

```typescript
function loadMessagesFromStorage(storageKey: string): UIMessage[] {
  const compressed = localStorage.getItem(storageKey);
  if (!compressed) return [];

  // Intentar descompresión (formato nuevo)
  try {
    const decompressed = decompress(compressed);
    parsed = decompressed ? JSON.parse(decompressed) : null;
  } catch {
    // Fallback a formato no comprimido (backward compatibility)
    parsed = JSON.parse(compressed);
  }
}
```

💡 **¿Por qué dos formatos?** Versiones anteriores guardaban sin comprimir. Este código soporta ambos formatos para no perder historiales viejos.

**Guardar con debounce**

```typescript
const debouncedSave = useDebouncedCallback((key, messagesToSave) => {
  const recentMessages = messagesToSave.slice(-MAX_STORED_MESSAGES); // Solo los últimos 100
  const compressed = compress(JSON.stringify(recentMessages));
  localStorage.setItem(key, compressed);
}, debounceMs); // Espera 500ms después del último cambio
```

🧠 **Concepto**: **Debounce** = espera a que el usuario pare de hacer cosas antes de ejecutar. Si envías 5 mensajes rápido, solo se guarda UNA vez (no 5 veces). Esto mejora el rendimiento.

**Manejo de cuota excedida**

```typescript
if (e instanceof Error && e.name === 'QuotaExceededError') {
  // Si localStorage está lleno, guardar solo la mitad de los mensajes
  const halfMessages = messagesToSave.slice(-Math.floor(MAX_STORED_MESSAGES / 2));
  localStorage.setItem(key, compress(JSON.stringify(halfMessages)));
}
```

💡 **¿Por qué no fallar?** `localStorage` tiene un límite de ~5MB. Si el historial crece demasiado, reducimos a la mitad en vez de perder todo.

---

## 📄 `hooks/use-voice-input.ts` — Grabación y Transcripción de Voz

Es el hook encargado de gestionar integralmente el ciclo de vida de la grabación de audio y su posterior transcripción a texto. Sirve para proveer una interfaz de programación extremadamente simple a nivel de componentes (ofreciendo estados como `isListening`, `transcript` y la función `toggleListening()`), abstrayendo todo el ruidoso código subyacente. Existe debido a que la intercepción de audio en los navegadores web modernos es muy compleja e involucra la solicitud asíncrona de permisos de micrófono, la manipulación de la API `MediaRecorder` y el enrutamiento del audio resultante hacia las Server Actions.

### Flujo de Grabación

```
1. Usuario clica "🎤"          → toggleListening()
2. MediaRecorder inicia        → isListening = true
3. Usuario habla...
4. Usuario clica "🎤" de nuevo → toggleListening()
5. MediaRecorder para          → isProcessing = true
6. Audio se envía a Gemini     → transcribeAudio(audioDataUrl)
7. Texto llega                 → onTranscript(text) + isProcessing = false
```

💡 **¿Por qué Gemini y no Web Speech API?** Gemini entiende terminología técnica (UMA, BCA) y español con acentos. Web Speech API es el fallback si no hay internet o API key.

---

## 📄 `hooks/use-file-upload.ts` — Gestión de Archivos

Es un hook dedicado en exclusiva a la etapa de validación, sanitización y preparación de cualquier archivo adjuntado por el usuario antes de ser procesado por la IA. Sirve primariamente para verificar que el tipo MIME corresponda a las extensiones permitidas, comprobar empíricamente que el peso no exceda los estrictos límites del servidor y generar un "preview" visual en base64 para presentarlo en la interfaz. Su existencia asegura que la aplicación rechace de antemano el envío de información maligna o excesivamente grande, ahorrando tráfico de red al no transmitir archivos abocados a fallar.

---

## 📄 `hooks/use-keyboard-shortcuts.ts` — Atajos de Teclado

Representa el manejador inteligente que vincula y registra atajos de teclado globales en todo el ámbito de la interfaz gráfica. Sirve pura y exclusivamente para mejorar la productividad general del operario mediante atajos tácticos, tales como presionar `Ctrl+Enter` para despachar mensajes formales o pulsar la tecla `Escape` para cancelar la grabación actual. Existe con la filosofía de que los técnicos, usualmente dotados de alta carga de trabajo computacional, demandan herramientas interactables sin depender constantemente de buscar elementos con el cursor del mouse.

---

## 📄 `hooks/use-toast.ts` — Notificaciones

Se trata de un conveniente envoltorio ("wrapper") que engloba toda la lógica tras el sistema de notificaciones temporales emergentes conocidas como toasts. Sirve para abstraer de configuraciones complejas el acto de notificar, proveyendo a cualquier componente del proyecto con atajos semánticos directos como `toast.success("Carga completada")` o `toast.error("Conexión fallida")`. Existe porque invocar notificaciones de estado debería ser un proceso trivial y limpio en el código, garantizando además que todas las ventanas emergentes mantengan una identidad visual y duración unificada.

---

## 📄 `hooks/use-work-order-commands.ts` — Comandos de Órdenes de Trabajo

Es el hook maestro que orquesta la interpretación semántica y ejecución reactiva de los comandos estructurados de voz en contraposición con el backend real del sistema GIMA. Sirve de puente activo para convertir una intención vocal como "Crear orden prioritaria para la Unidad Manejadora" en una mutación auténtica (POST request) sobre la base de datos subyacente. Existe puntualmente para desacoplar el motor de transcripción pura (que solamente devuelve texto en crudo) de la capa lógica de negocio, asegurando que el acto de operar el sistema "con manos libres" esté aislado y testeable dentro del árbol de componentes.

---

**← Anterior**: [05 — Configuración](./05-configuracion.md) | **Siguiente**: [07 — Utilidades Core](./07-lib-utilidades.md) →
