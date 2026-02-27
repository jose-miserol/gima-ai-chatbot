# 12 — Componentes AI Elements (`components/ai-elements/`)

> Estos 30 componentes están especializados en **renderizar contenido generado por IA**: mensajes, código, razonamiento, herramientas, canvas, y más.

---

## ¿Cuál es la Diferencia con los UI Components?

| UI Components (`ui/`)          | AI Elements (`ai-elements/`)           |
| ------------------------------ | -------------------------------------- |
| Genéricos (Button, Input)      | Específicos de IA (Message, CodeBlock) |
| Sin lógica de negocio          | Con lógica de rendering de IA          |
| Reutilizables en cualquier app | Solo útiles en un chat con IA          |

---

## Componentes de Mensajería

| Componente       | Archivo            | ¿Para qué?                                                                                                                                   |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message**      | `message.tsx`      | Renderiza un mensaje individual (usuario o asistente). Es el más grande (~11KB). Maneja markdown, imágenes, tool results.                    |
| **Conversation** | `conversation.tsx` | Contenedor que lista todos los mensajes con scroll                                                                                           |
| **PromptInput**  | `prompt-input.tsx` | Campo de entrada avanzado del chat (~39KB, el más grande). Incluye textarea auto-resizable, botones de adjuntar, voz, enviar, y sugerencias. |
| **Loader**       | `loader.tsx`       | Indicador animado mientras la IA genera respuesta                                                                                            |
| **Shimmer**      | `shimmer.tsx`      | Efecto de "brillar" mientras se espera contenido                                                                                             |
| **Queue**        | `queue.tsx`        | Cola de mensajes pendientes de procesar                                                                                                      |

---

## Componentes de Contenido IA

| Componente         | Archivo                | ¿Para qué?                                                                  |
| ------------------ | ---------------------- | --------------------------------------------------------------------------- |
| **CodeBlock**      | `code-block.tsx`       | Bloque de código con syntax highlighting (Shiki). Botón de copiar incluido. |
| **Reasoning**      | `reasoning.tsx`        | Muestra el razonamiento paso a paso de la IA                                |
| **ChainOfThought** | `chain-of-thought.tsx` | Visualización expandible de la cadena de pensamiento                        |
| **Artifact**       | `artifact.tsx`         | Renderiza artefactos generados (documentos, código largo)                   |
| **Sources**        | `sources.tsx`          | Lista de fuentes citadas por la IA                                          |
| **InlineCitation** | `inline-citation.tsx`  | Citas numeradas dentro del texto generado                                   |
| **WebPreview**     | `web-preview.tsx`      | Preview embebido de URLs referenciadas                                      |
| **Image**          | `image.tsx`            | Renderiza imágenes adjuntas en mensajes                                     |
| **Suggestion**     | `suggestion.tsx`       | Burbujas de sugerencias de preguntas rápidas                                |

---

## Componentes de Herramientas

| Componente       | Archivo            | ¿Para qué?                                                        |
| ---------------- | ------------------ | ----------------------------------------------------------------- |
| **Tool**         | `tool.tsx`         | Renderiza el resultado de una invocación de herramienta por la IA |
| **Confirmation** | `confirmation.tsx` | Diálogo para que el usuario apruebe/rechace una acción de la IA   |
| **Plan**         | `plan.tsx`         | Muestra un plan de acción generado (lista de pasos)               |
| **Task**         | `task.tsx`         | Renderiza una tarea individual dentro de un plan                  |
| **Checkpoint**   | `checkpoint.tsx`   | Marca un punto de control en la conversación                      |

---

## Componentes de Canvas (React Flow)

| Componente     | Archivo          | ¿Para qué?                                            |
| -------------- | ---------------- | ----------------------------------------------------- |
| **Canvas**     | `canvas.tsx`     | Canvas interactivo para diagramas (usa @xyflow/react) |
| **Node**       | `node.tsx`       | Nodo individual en el canvas                          |
| **Edge**       | `edge.tsx`       | Conexión/flecha entre nodos                           |
| **Connection** | `connection.tsx` | Línea de conexión durante drag                        |
| **Controls**   | `controls.tsx`   | Controles del canvas (zoom, centrar)                  |
| **Panel**      | `panel.tsx`      | Panel lateral del canvas                              |
| **Toolbar**    | `toolbar.tsx`    | Barra de herramientas del canvas                      |

---

## Componentes de Configuración

| Componente        | Archivo              | ¿Para qué?                                                         |
| ----------------- | -------------------- | ------------------------------------------------------------------ |
| **ModelSelector** | `model-selector.tsx` | Selector del modelo de IA (dropdown con los modelos disponibles)   |
| **Context**       | `context.tsx`        | React Context Provider para estado compartido entre componentes IA |
| **OpenInChat**    | `open-in-chat.tsx`   | Botón/widget para abrir contenido en el chat principal             |

---

## 💡 ¿Cómo se Conectan?

```
ChatConversation (features/chat/)
  └── map(messages) →
        Message (ai-elements/message.tsx)
          ├── Si es texto → Markdown con CodeBlock
          ├── Si es imagen → Image
          ├── Si es tool call → Tool + Confirmation
          ├── Si tiene razonamiento → Reasoning
          └── Si tiene fuentes → Sources + InlineCitation
```

---

**← Anterior**: [11 — Componentes Shared](./11-componentes-shared.md) | **Siguiente**: [13 — Feature: Chat](./13-feature-chat.md) →
