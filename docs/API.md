# Documentación de API - GIMA AI Chatbot

Esta guía documenta todos los endpoints HTTP y Server Actions disponibles.

## 📡 Endpoints HTTP

### POST `/api/chat`

Endpoint principal para streaming de respuestas del chatbot.

#### Request

**Headers:**

```http
Content-Type: application/json
```

**Body:**

```typescript
{
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string | object;
    parts?: Array<{ type: string; text?: string }>;
    id?: string;
    createdAt?: string | Date;
  }>;
  model?: string; // Opcional, default: "llama-3.3-70b-versatile"
}
```

**Ejemplo:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "¿Cómo hago mantenimiento preventivo a una bomba centrífuga?",
      "id": "msg_abc123",
      "createdAt": "2025-12-19T10:30:00Z"
    }
  ],
  "model": "llama-3.3-70b-versatile"
}
```

#### Response

**Content-Type:** `text/event-stream` (Server-Sent Events)

**Stream Format:**

```
data: {"type":"text-delta","textDelta":"Hola"}

data: {"type":"text-delta","textDelta":", "}

data: {"type":"text-delta","textDelta":"el "}

data: [DONE]
```

**Eventos del Stream:**

| Tipo         | Descripción              | Ejemplo                                    |
| ------------ | ------------------------ | ------------------------------------------ |
| `text-delta` | Fragmento de texto nuevo | `{"type":"text-delta","textDelta":"Hola"}` |
| `[DONE]`     | Fin del stream           | `data: [DONE]`                             |

#### Códigos de Estado

| Código | Significado           | Descripción                                          |
| ------ | --------------------- | ---------------------------------------------------- |
| `200`  | OK                    | Stream iniciado correctamente                        |
| `400`  | Bad Request           | Validación fallida (ej: formato de mensaje inválido) |
| `500`  | Internal Server Error | Error del servidor o de la API de GROQ               |

#### Validación de Entrada

El endpoint valida:

- ✅ `messages` debe ser un array
- ✅ Cada mensaje debe tener `role` válido
- ✅ `content` puede ser string u objeto
- ✅ `parts` se valida opcionalmente - partes inválidas se ignoran automáticamente
- ✅ Conversión automática de `createdAt` string → Date

> [!NOTE]
> **Mejora reciente**: El campo `parts` ahora usa `.catch(undefined)` en la validación Zod, lo que significa que estructuras de `parts` inválidas se ignoran en lugar de causar errores de validación. Esto mejora la compatibilidad con diferentes formatos de mensaje del AI SDK.

**Ejemplo de Error (400):**

```json
{
  "error": "Invalid request format",
  "details": [
    {
      "code": "invalid_type",
      "expected": "array",
      "received": "string",
      "path": ["messages"]
    }
  ]
}
```

#### Modelos Disponibles

| ID del Modelo             | Proveedor | Descripción                              |
| ------------------------- | --------- | ---------------------------------------- |
| `llama-3.3-70b-versatile` | GROQ      | **Default**. Balance velocidad/calidad   |
| `llama-3.3-70b-specdec`   | GROQ      | Decodificación especulativa (más rápido) |
| `gemini-2.0-flash-exp`    | Google    | Experimental, multimodal                 |

#### Límites

- **Body size máximo:** 3MB
- **Timeout:** Sin límite explícito (streaming)
- **Rate limiting:** No implementado (pendiente)

---

## ⚡ Server Actions

Las Server Actions son funciones del lado del servidor que se pueden llamar directamente desde componentes cliente.

### `transcribeAudio()`

Transcribe audio a texto usando Gemini Flash Lite.

**Ubicación:** [`app/actions.ts`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/actions.ts)

#### Firma

```typescript
async function transcribeAudio(audioDataUrl: string): Promise<{
  text: string;
  success: boolean;
  error?: string;
}>;
```

#### Parámetros

| Nombre         | Tipo     | Descripción                                             |
| -------------- | -------- | ------------------------------------------------------- |
| `audioDataUrl` | `string` | Audio en base64 (formato: `data:audio/webm;base64,...`) |

#### Retorno

```typescript
{
  text: string;      // Texto transcrito (vacío si falla)
  success: boolean;  // true si la transcripción fue exitosa
  error?: string;    // Mensaje de error (solo si success = false)
}
```

#### Ejemplo de Uso

```typescript
import { transcribeAudio } from '@/app/actions';

// En un componente cliente
const handleAudioBlob = async (blob: Blob) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Audio = reader.result as string;
    const result = await transcribeAudio(base64Audio);

    if (result.success) {
      console.log('Transcripción:', result.text);
    } else {
      console.error('Error:', result.error);
    }
  };
  reader.readAsDataURL(blob);
};
```

#### Comportamiento

1. **Validación:** Verifica que el audio no esté vacío
2. **Procesamiento:** Envía a Gemini Flash Lite con prompt específico
3. **Post-procesamiento:**
   - Elimina timestamps (formato `00:00`)
   - Elimina saltos de línea excesivos
   - Normaliza espacios

#### Configuración

- **Modelo:** `gemini-2.5-flash-lite`
- **Temperature:** `0` (determinístico)
- **Prompt:** Definido en [`VOICE_PROMPT`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/config/index.ts)

---

### `analyzePartImage()`

Analiza una imagen de una pieza industrial para inventario.

**Ubicación:** [`app/actions.ts`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/actions.ts)

#### Firma

```typescript
async function analyzePartImage(
  imageDataUrl: string,
  mediaType?: string
): Promise<{
  text: string;
  success: boolean;
  error?: string;
}>;
```

#### Parámetros

| Nombre         | Tipo     | Default        | Descripción                                                      |
| -------------- | -------- | -------------- | ---------------------------------------------------------------- |
| `imageDataUrl` | `string` | -              | Imagen en base64                                                 |
| `mediaType`    | `string` | `'image/jpeg'` | MIME type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) |

#### Retorno

```typescript
{
  text: string;      // Análisis detallado de la pieza
  success: boolean;  // true si el análisis fue exitoso
  error?: string;    // Mensaje de error (solo si success = false)
}
```

#### Ejemplo de Uso

```typescript
import { analyzePartImage } from '@/app/actions';

const handleImageUpload = async (file: File) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Image = reader.result as string;
    const result = await analyzePartImage(base64Image, file.type);

    if (result.success) {
      console.log('Análisis:', result.text);
      // Ejemplo de salida:
      // "**Tipo de pieza:** Rodamiento de bolas
      //  **Marca visible:** SKF
      //  **Estado:** Desgaste moderado..."
    }
  };
  reader.readAsDataURL(file);
};
```

#### Comportamiento

1. **Validación:** Verifica que la imagen no esté vacía
2. **Procesamiento:** Envía a Gemini Vision con prompt de inventario
3. **Análisis:** Identifica tipo, marca, estado, dimensiones

#### Configuración

- **Modelo:** `gemini-2.5-flash` (Vision)
- **Temperature:** `0.2` (ligeramente creativo para descripciones)
- **Prompt:** Definido en [`INVENTORY_PROMPT`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/config/index.ts)

---

## 🔒 Autenticación y Seguridad

### Variables de Entorno Requeridas

```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyxxxxxxxxxxxxx
NODE_ENV=development  # 'development', 'production', o 'test'
```

> [!IMPORTANT]
> **Codificación UTF-8 Requerida**: Asegúrate de que tu archivo `.env.local` esté guardado con codificación UTF-8. Next.js no puede leer archivos .env en otros formatos (como UTF-16LE). En Windows, puedes convertir el archivo usando PowerShell:
>
> ```powershell
> $content = Get-Content .env.local -Raw -Encoding Unicode
> [System.IO.File]::WriteAllText((Resolve-Path .env.local), $content, [System.Text.UTF8Encoding]::new($false))
> ```

### Validación

Las API keys se validan al inicio usando Zod con validación condicional:

```typescript
// app/config/env.ts
const envSchema = z.object({
  GROQ_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('gsk_'), {
      message: 'GROQ API key debe empezar con "gsk_" si se proporciona',
    }),
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('AIza'), {
      message: 'Google API key debe empezar con "AIza" si se proporciona',
    }),
});

export const env = envSchema.parse(process.env);
```

> [!WARNING]
> Las API keys son **opcionales** en el schema para prevenir crashes al inicio, pero las funciones de IA **fallarán en runtime** si las keys no están configuradas. Esto permite que la aplicación inicie incluso con configuración incompleta, útil para desarrollo y troubleshooting.

---

## 📊 Manejo de Errores

### Estrategia General

```typescript
try {
  // Operación
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

  return {
    success: false,
    error: errorMessage,
  };
}
```

### Códigos de Error Comunes

| Código | Origen      | Causa                   | Solución                       |
| ------ | ----------- | ----------------------- | ------------------------------ |
| `400`  | API Route   | Validación Zod fallida  | Revisar formato del request    |
| `401`  | GROQ/Gemini | API key inválida        | Verificar variables de entorno |
| `429`  | GROQ/Gemini | Límite de rate exceeded | Esperar o usar otro modelo     |
| `500`  | Servidor    | Error no controlado     | Revisar logs del servidor      |

---

## 🧪 Testing

### Ejemplo con `curl`

```bash
# Test básico de chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hola"}
    ]
  }'
```

### Ejemplo con JavaScript

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '¿Qué es el mantenimiento preventivo?' }],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log('Chunk:', chunk);
}
```

---

## ⚛️ React Hooks API

### `usePersistentChat()`

Hook personalizado que envuelve `useChat` del AI SDK con persistencia en localStorage.

**Ubicación:** [`app/hooks/use-persistent-chat.ts`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/hooks/use-persistent-chat.ts)

#### Firma

```typescript
function usePersistentChat(options?: {
  storageKey?: string;
  debounceMs?: number;
  enablePersistence?: boolean;
}): UsePersistentChatReturn;
```

#### Parámetros

| Nombre              | Tipo      | Default               | Descripción                                       |
| ------------------- | --------- | --------------------- | ------------------------------------------------- |
| `storageKey`        | `string`  | `'gima-chat-history'` | Clave para localStorage                           |
| `debounceMs`        | `number`  | `500`                 | Retraso en ms para escrituras a localStorage      |
| `enablePersistence` | `boolean` | `true`                | Habilita/Deshabilita persistencia en localStorage |

> [!TIP]
> **Nueva característica**: El parámetro `enablePersistence` permite deshabilitar fácilmente la persistencia de localStorage sin cambiar el código. Útil para testing, demos, o cuando se requiere privacidad total.

#### Retorno

Retorna todas las propiedades de `useChat` del AI SDK más:

| Propiedad           | Tipo                                     | Descripción                              |
| ------------------- | ---------------------------------------- | ---------------------------------------- |
| `sendMessage`       | `(message, options?) => Promise<string>` | Envía un mensaje al chat                 |
| `regenerate`        | `() => void`                             | Regenera la última respuesta             |
| `clearHistory`      | `() => void`                             | Limpia todo el historial                 |
| `visionResponse`    | `{id: string; text: string} \| null`     | Respuesta de análisis de visión guardada |
| `setVisionResponse` | `(response) => void`                     | Actualiza la respuesta de visión         |

#### Ejemplo de Uso

```typescript
import { usePersistentChat } from '@/app/hooks/use-persistent-chat';

function ChatComponent() {
  const {
    messages,
    sendMessage,
    status,
    clearHistory,
    enablePersistence = true
  } = usePersistentChat({
    storageKey: 'my-chat',
    debounceMs: 1000,
    enablePersistence: true // false para deshabilitar localStorage
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={clearHistory}>Limpiar historial</button>
    </div>
  );
}
```

#### Comportamiento con `enablePersistence`

- **`true` (default)**: Mensajes se guardan y cargan automáticamente de localStorage
- **`false`**: Chat funciona normalmente pero sin persistencia
  - No carga mensajes previos al montar
  - No guarda nuevos mensajes
  - No guarda respuestas de visión
  - Útil para sesiones temporales o privadas

---

### `useFileSubmission()`

Hook para manejo de análisis de archivos (imágenes y PDFs) en el chat.

**Ubicación:** [`app/components/features/chat/hooks/use-file-submission.ts`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/app/components/features/chat/hooks/use-file-submission.ts)

#### Firma

```typescript
function useFileSubmission(params: {
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  sendMessage: (message, options?) => Promise<string | null | undefined>;
  isListening: boolean;
  toggleListening: () => void;
}): {
  handleSubmit: (message: PromptInputMessage) => Promise<void>;
  isAnalyzing: boolean;
  analyzingFileType: 'image' | 'pdf' | null;
};
```

#### Parámetros

| Nombre            | Tipo       | Descripción                                           |
| ----------------- | ---------- | ----------------------------------------------------- |
| `setMessages`     | `function` | Función para actualizar el array de mensajes          |
| `sendMessage`     | `function` | Función para enviar mensajes regulares (sin archivos) |
| `isListening`     | `boolean`  | Si el modo de voz está escuchando activamente         |
| `toggleListening` | `function` | Función para alternar el estado de escucha de voz     |

#### Retorno

| Propiedad           | Tipo                         | Descripción                                   |
| ------------------- | ---------------------------- | --------------------------------------------- |
| `handleSubmit`      | `(message) => Promise<void>` | Manejador de envío para mensajes con adjuntos |
| `isAnalyzing`       | `boolean`                    | Si se está analizando un archivo actualmente  |
| `analyzingFileType` | `'image' \| 'pdf' \| null`   | Tipo de archivo siendo analizado              |

> [!NOTE]
> **Nueva característica**: `analyzingFileType` permite mostrar mensajes específicos en la UI dependiendo del tipo de archivo (ej: "📄 Extrayendo contenido del PDF..." vs "📷 Analizando contenido de la imagen...").

#### Ejemplo de Uso

```typescript
import { useFileSubmission } from '@/app/components/features/chat/hooks/use-file-submission';

function ChatWithFiles() {
  const { handleSubmit, isAnalyzing, analyzingFileType } = useFileSubmission({
    setMessages,
    sendMessage,
    isListening: false,
    toggleListening: () => {},
  });

  return (
    <div>
      {isAnalyzing && (
        <div>
          {analyzingFileType === 'pdf'
            ? '📄 Extrayendo contenido del PDF...'
            : '📷 Analizando contenido de la imagen...'}
        </div>
      )}
      {/* Form para subir archivos */}
    </div>
  );
}
```

#### Tipos de Archivos Soportados

- **Imágenes**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **PDFs**: `application/pdf`

#### Límites

- **Imágenes**: 10MB máximo
- **PDFs**: 20MB máximo

---

## 📚 Enlaces Relacionados

- [Arquitectura del Sistema](./ARCHITECTURE.md)
- [Guía de Despliegue](./DEPLOYMENT.md)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [GROQ API Docs](https://console.groq.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
