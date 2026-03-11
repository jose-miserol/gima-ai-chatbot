# GIMA AI Tools - Roadmap General

**Sistema:** GIMA - Gestión Integral de Mantenimiento y Activos  
**Versión:** 0.0.1  
**Última actualización:** 2026-02-24

---

## Visión General

GIMA integra 6 herramientas de IA que asisten a técnicos de mantenimiento. Todas siguen el mismo patrón arquitectónico de 5 capas descrito en la sección [Arquitectura Común](#arquitectura-común).

---

## Índice de Features

| #   | Feature                                         | Roadmap                                                              | Estado          | Responsables                               |
| --- | ----------------------------------------------- | -------------------------------------------------------------------- | --------------- | ------------------------------------------ |
| 1   | [Voice Fill](#1-voice-fill)                     | [roadmap-voice-fill.md](./roadmap-voice-fill.md)                     | ✅ Implementado | Jose Miserol                               |
| 2   | [Checklist Builder](#2-checklist-builder)       | [roadmap-checklist-builder.md](./roadmap-checklist-builder.md)       | ✅ Implementado | Jose Miserol                               |
| 3   | [Photo-to-Part](#3-photo-to-part)               | [roadmap-photo-to-part.md](./roadmap-photo-to-part.md)               | ✅ Implementado | Jose Miserol                               |
| 4   | [Activity Summaries](#4-activity-summaries)     | [roadmap-activity-summaries.md](./roadmap-activity-summaries.md)     | ✅ Implementado | Jose Miserol, Aaron Carreño, Edgar Morales |
| 5   | [Voice Requests](#5-voice-requests)             | [roadmap-voice-requests.md](./roadmap-voice-requests.md)             | ✅ Implementado | Jose Miserol                               |
| 6   | [Data Transformations](#6-data-transformations) | [roadmap-data-transformations.md](./roadmap-data-transformations.md) | ✅ Implementado | Jose Miserol                               |

---

## Arquitectura Común

Todas las AI Tools siguen el mismo patrón de 5 capas. Entender esto es clave para estudiar cualquier feature:

```
┌──────────────────────────────────────────────────────────────┐
│  CAPA 1: PÁGINA (Routing)                                    │
│  app/tools/<feature>/page.tsx                                │
│  → Punto de entrada, metadata SEO, renderiza componente      │
├──────────────────────────────────────────────────────────────┤
│  CAPA 2: COMPONENTES (UI)                                    │
│  app/components/features/ai-tools/<feature>/                 │
│  → Componente principal, form, preview, lista/historial      │
│  → types.ts, constants.ts, index.ts (barrel exports)         │
├──────────────────────────────────────────────────────────────┤
│  CAPA 3: HOOKS (Estado Cliente)                              │
│  app/components/features/ai-tools/<feature>/hooks/           │
│  → Manejo de estado, llamadas al server action               │
│  → Templates/historial en localStorage                       │
├──────────────────────────────────────────────────────────────┤
│  CAPA 4: SERVER ACTIONS (Bridge)                             │
│  app/actions/<feature>.ts                                    │
│  → 'use server' - puente entre cliente y servidor            │
│  → Evita exponer env vars al cliente                         │
├──────────────────────────────────────────────────────────────┤
│  CAPA 5: SERVICIOS + SCHEMAS + PROMPTS (Backend)             │
│  app/lib/services/<feature>-ai-service.ts                    │
│  app/lib/schemas/<feature>.schema.ts                         │
│  app/config/prompts/<feature>-generation.ts                  │
│  → Lógica de IA, validación Zod, prompt engineering          │
│  → Hereda de BaseAIService (retry, cache, logging)           │
└──────────────────────────────────────────────────────────────┘
```

### Flujo de Datos (aplica a TODAS las features)

```
Usuario → Componente UI → Hook → Server Action → AI Service → GROQ/Gemini API
                                                        ↓
Usuario ← Preview UI  ←  Hook (estado) ← Resultado validado con Zod
```

---

## Descripción por Feature

### 1. Voice Fill

Relleno de formularios por voz. El técnico habla y la IA transcribe y llena campos automáticamente.

- **Entrada:** Audio del micrófono (MediaRecorder API)
- **Modelo IA:** Gemini Flash Lite (transcripción)
- **Salida:** Campos de formulario rellenados

### 2. Checklist Builder

Generación de checklists de mantenimiento personalizados según tipo de activo y tarea.

- **Entrada:** Tipo de activo, tipo de mantenimiento, contexto
- **Modelo IA:** GROQ Llama 3.3 70B
- **Salida:** Checklist estructurado con ítems verificables

### 3. Photo-to-Part

Análisis de fotos de piezas industriales para crear registros de inventario.

- **Entrada:** Imagen de pieza (upload o cámara)
- **Modelo IA:** Gemini Vision
- **Salida:** Metadata extraída (nombre, marca, modelo, estado, cantidad)

### 4. Activity Summaries

Transformación de notas técnicas en resúmenes profesionales multi-sección.

- **Entrada:** Notas de actividades, estilo, nivel de detalle
- **Modelo IA:** GROQ Llama 3.3 70B
- **Salida:** Resumen con título, ejecutivo, secciones ordenadas

> 📖 Para una guía detallada del orden de archivos, ver [roadmap-activity-summaries.md](./roadmap-activity-summaries.md)

### 5. Voice Requests

Comandos de voz para crear órdenes de trabajo usando lenguaje natural.

- **Entrada:** Audio con comando en lenguaje natural
- **Modelo IA:** Gemini Flash Lite (transcripción) + GROQ (parsing)
- **Salida:** Orden de trabajo pre-llenada para confirmación

### 6. Data Transformations

Transformación de datos (JSON, CSV) usando instrucciones en lenguaje natural.

- **Entrada:** Datos + descripción de transformación deseada
- **Modelo IA:** GROQ Llama 3.3 70B
- **Salida:** Datos transformados con preview before/after

---

## Stack Tecnológico Resumido

| Capa            | Tecnología                                    |
| --------------- | --------------------------------------------- |
| Frontend        | Next.js 16, React 19, Tailwind CSS 4          |
| IA - Texto      | GROQ API (Llama 3.3 70B) via Vercel AI SDK v5 |
| IA - Multimodal | Google Gemini 2.5 Flash / Flash Lite          |
| Validación      | Zod                                           |
| Persistencia    | localStorage (cliente)                        |
| Testing         | Vitest                                        |

---

## Cómo Estudiar una Feature

1. **Lee el roadmap específico** en `docs/studies/roadmap-<feature>.md`
2. **Empieza por la página** (`app/tools/<feature>/page.tsx`) — es el punto de entrada
3. **Sigue al componente principal** — orquesta form, preview y lista
4. **Revisa los hooks** — entiende el manejo de estado
5. **Lee el server action** — es solo un puente, mínimo código
6. **Profundiza en el servicio** — aquí está la lógica real de IA
7. **Revisa schema y prompts** — validación y prompt engineering

---

**Mantenedores:** Jose Miserol, Miguelangel Leonet
