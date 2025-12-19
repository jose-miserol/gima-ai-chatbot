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
- ✅ Conversión automática de `createdAt` string → Date

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
```

### Validación

Todas las API keys se validan al inicio usando Zod:

```typescript
// app/config/env.ts
const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY es requerida'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, 'Google API Key es requerida'),
});

export const env = envSchema.parse(process.env);
```

Si falta alguna key, la aplicación **fallará al inicio** con un mensaje claro.

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

## 📚 Enlaces Relacionados

- [Arquitectura del Sistema](./ARCHITECTURE.md)
- [Guía de Despliegue](./DEPLOYMENT.md)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [GROQ API Docs](https://console.groq.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
