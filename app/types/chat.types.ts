/**
 * @file chat.types.ts
 * @module app/types/chat
 *
 * ============================================================
 * TIPOS COMPARTIDOS DEL SISTEMA DE CHAT
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define las interfaces TypeScript que describen la forma de los mensajes
 *   en todo el flujo de chat de GIMA: desde el cliente hasta la API,
 *   pasando por el ChatService y el modelo de IA.
 *
 * POR QUÉ TIPOS SEPARADOS Y NO USAR LOS DEL SDK:
 *   El Vercel AI SDK tiene sus propios tipos (`UIMessage`, `CoreMessage`), pero:
 *   1. Los mensajes de GIMA pueden incluir partes de imagen o archivo (multimodal).
 *   2. Los mensajes del backend pueden llegar "malformados" (content como objeto o string).
 *   3. Necesitamos una capa de sanitización tipada entre el SDK y el ChatService.
 *   Estos tipos representan esa capa intermedia, no reemplazan los del SDK.
 *
 * DIAGRAMA DE FLUJO DE TIPOS:
 *   [Navegador] UIMessage (SDK) → ChatAPIRequest (este archivo) →
 *   [ChatService] RawMessage → SanitizedMessage →
 *   [GROQ] CoreMessage (SDK)
 *
 * DÓNDE SE USAN:
 *   - app/lib/services/chat-service.ts → recibe ChatAPIRequest, produce SanitizedMessage
 *   - app/api/chat/route.ts → tipado del body del POST
 *   - Componentes de chat que procesan partes de mensajes multimodales
 * ============================================================
 */

// ============================================================
// TIPOS DE PARTES DE MENSAJE (MULTIMODAL)
// ============================================================

/**
 * MessagePart — Unión discriminada de los tipos de contenido posibles en un mensaje.
 *
 * QUÉ ES:
 *   Un mensaje de chat puede contener múltiples "partes" de distintos tipos.
 *   Esta unión discriminada (discriminated union) por `type` permite a TypeScript
 *   inferir el tipo correcto en cada rama condicional.
 *
 * TIPOS DISPONIBLES:
 *
 *   text  → Texto plano del mensaje. El caso más común (>99% de mensajes).
 *
 *   image → Imagen adjunta al mensaje (ej: foto de pieza para el módulo de visión).
 *           `imageUrl`: puede ser una URL externa o un data URL base64.
 *           `mimeType`: necesario para que la API de Gemini identifique el formato.
 *
 *   file  → Documento adjunto (PDF de manual técnico).
 *           `data`: contenido del archivo en base64.
 *           `mediaType`: MIME type del documento (ej: 'application/pdf').
 *
 * @example
 * ```typescript
 * // TypeScript infiere el tipo correcto en cada rama:
 * function renderPart(part: MessagePart) {
 *   if (part.type === 'text') {
 *     return <p>{part.text}</p>; // TypeScript sabe que `text` existe
 *   }
 *   if (part.type === 'image') {
 *     return <img src={part.imageUrl} />; // TypeScript sabe que `imageUrl` existe
 *   }
 * }
 * ```
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string };

// ============================================================
// MENSAJE SANITIZADO
// ============================================================

/**
 * SanitizedMessage — Mensaje que ha pasado por validación y normalización.
 *
 * QUÉ ES:
 *   La forma "limpia" y garantizada de un mensaje, después de que ChatService
 *   ha validado su schema, normalizado el campo `content` y verificado
 *   que `role` sea uno de los tres valores permitidos.
 *
 * POR QUÉ `content` ES string Y NO `string | object`:
 *   Después de la sanitización, `content` siempre es un string extraído del
 *   campo de texto principal. Los objetos complejos van en `parts`.
 *   Esta normalización garantiza que el modelo de IA reciba texto plano.
 *
 * CAMPO `parts` OPCIONAL:
 *   Solo presente en mensajes multimodales. Los mensajes de texto puro
 *   no incluyen `parts` para mantener el payload lo más pequeño posible.
 */
export interface SanitizedMessage {
  /** Rol del emisor en la conversación. Determina cómo lo interpreta el LLM. */
  role: 'user' | 'assistant' | 'system';
  /** Contenido textual principal del mensaje (ya sanitizado y normalizado). */
  content: string;
  /** Partes adicionales del mensaje para contenido multimodal (imagen, PDF). */
  parts?: MessagePart[];
  /** ID único del mensaje (generado por el SDK o el cliente). */
  id?: string;
  /** Timestamp de creación del mensaje. */
  createdAt?: Date;
}

// ============================================================
// TIPOS DE REQUEST Y RESPONSE DE LA API
// ============================================================

/**
 * ChatAPIRequest — Forma esperada del body JSON en POST /api/chat.
 *
 * QUÉ ES:
 *   El contrato entre el cliente (hook useChat) y el servidor (route.ts).
 *   ChatService recibe `unknown` y lo valida contra este tipo con Zod.
 *
 * CAMPO `model` OPCIONAL:
 *   Si el usuario seleccionó un modelo específico en el selector de la UI,
 *   se incluye aquí. Si es undefined, ChatService usa DEFAULT_MODEL de models.ts.
 *   Solo se aceptan valores de `ModelValue` (validados en ChatService).
 */
export interface ChatAPIRequest {
  /** Lista de mensajes de la conversación (historial completo). */
  messages: SanitizedMessage[];
  /**
   * Modelo de IA a usar. Si se omite, se usa DEFAULT_MODEL.
   * Solo se aceptan valores de la lista AVAILABLE_MODELS.
   */
  model?: string;
}

/**
 * ChatAPIResponse — Tipo de respuesta para llamadas no-streaming a la API de chat.
 *
 * QUÉ ES:
 *   Usado en contextos donde se necesita una respuesta JSON completa en lugar
 *   del stream SSE. Por ejemplo, en tests de integración o para herramientas
 *   que necesitan el texto completo antes de procesarlo.
 *
 * NOTA: En el uso normal del chat, la respuesta es un stream SSE (no JSON).
 *       Este tipo es para casos especiales y testing.
 */
export interface ChatAPIResponse {
  /** Indica si la llamada fue exitosa. */
  success: boolean;
  /** Mensaje de error si success es false. */
  error?: string;
  /** Datos de la respuesta si success es true. */
  data?: {
    /** Texto completo de la respuesta del asistente. */
    text?: string;
    /** Partes multimodales si la respuesta incluye contenido no textual. */
    parts?: MessagePart[];
  };
}

// ============================================================
// MENSAJE RAW (sin sanitizar)
// ============================================================

/**
 * RawMessage — Mensaje tal como puede llegar del cliente, posiblemente malformado.
 *
 * QUÉ ES:
 *   El tipo "antes de la validación". Representa mensajes que pueden tener
 *   el campo `content` como string O como objeto (dependiendo de la versión
 *   del SDK o del cliente que los generó), y `createdAt` como Date o string.
 *
 * POR QUÉ EXISTE (y no se usa directamente SanitizedMessage):
 *   El SDK de Vercel AI puede serializar mensajes con `content` como objeto
 *   `{ parts: [...], text: '...' }` en lugar de string plano. Versiones antiguas
 *   del SDK o clientes diferentes pueden enviar `createdAt` como ISO string
 *   en lugar de objeto Date.
 *
 *   ChatService recibe `RawMessage[]`, los normaliza y produce `SanitizedMessage[]`.
 *   Esta separación evita que errores de formato lleguen al modelo de IA.
 *
 * CUÁNDO content ES OBJETO:
 *   AI SDK v5 puede emitir mensajes donde `content` es `{ parts: MessagePart[] }`.
 *   ChatService extrae el texto de `content.text` o del primer part de tipo 'text'.
 */
export interface RawMessage {
  /** Rol del emisor. Mismo enum que SanitizedMessage. */
  role: 'user' | 'assistant' | 'system';
  /**
   * Contenido del mensaje. Puede ser:
   * - string: formato estándar de texto plano.
   * - objeto: formato AI SDK v5 con partes multimodales.
   */
  content: string | { parts?: MessagePart[]; text?: string };
  /** Partes multimodales opcionales (redundante con content objeto, pero algunos SDKs las separan). */
  parts?: MessagePart[];
  /** ID del mensaje (opcional, generado por el SDK). */
  id?: string;
  /**
   * Timestamp de creación. Puede ser Date (cliente reciente) o string ISO
   * (mensajes deserializados desde localStorage o transmitidos por red).
   */
  createdAt?: Date | string;
}
