# 📘 GIMA AI Chatbot — Documentación Completa del Proyecto

> **Sistema de Gestión Integral de Mantenimiento y Activos (GIMA)**
> Asistente inteligente con IA para la Universidad Nacional Experimental de Guayana (UNEG).

---

## Tabla de Contenido

1. [Visión General](#1-visión-general)
2. [Tecnologías Utilizadas](#2-tecnologías-utilizadas)
3. [Estructura de Carpetas](#3-estructura-de-carpetas)
4. [Archivos Raíz](#4-archivos-raíz)
5. [app/ — Núcleo de la Aplicación](#5-app--núcleo-de-la-aplicación)
   - [Punto de Entrada (layout + page)](#51-punto-de-entrada)
   - [Estilos Globales](#52-estilos-globales)
   - [api/ — Rutas de API](#53-api--rutas-de-api)
   - [actions/ — Server Actions](#54-actions--server-actions)
   - [config/ — Configuración](#55-config--configuración)
   - [constants/ — Constantes](#56-constants--constantes)
   - [hooks/ — Custom Hooks](#57-hooks--custom-hooks)
   - [lib/ — Lógica de Negocio](#58-lib--lógica-de-negocio)
   - [types/ — Tipos TypeScript](#59-types--tipos-typescript)
   - [utils/ — Utilidades](#510-utils--utilidades)
   - [tools/ — Páginas de Herramientas IA](#511-tools--páginas-de-herramientas-ia)
   - [components/ — Componentes React](#512-components--componentes-react)
6. [Flujo de Datos (Arquitectura)](#6-flujo-de-datos-arquitectura)
7. [Modelos de IA](#7-modelos-de-ia)
8. [Variables de Entorno](#8-variables-de-entorno)
9. [Scripts Disponibles](#9-scripts-disponibles)

---

## 1. Visión General

GIMA AI Chatbot es un asistente de mantenimiento industrial con IA construido con **Next.js 16** (App Router). Permite a técnicos e ingenieros de la UNEG:

- **Chatear** con texto, voz e imágenes sobre equipos y procedimientos.
- **Analizar piezas** industriales con visión por computadora (Gemini Vision).
- **Transcribir voz** con Gemini API y fallback a Web Speech API.
- **Ejecutar comandos de voz** para gestionar órdenes de trabajo.
- **Generar checklists** de mantenimiento con IA.
- **Crear resúmenes** profesionales de actividades.
- **Transformar datos** con validación inteligente.
- **Cerrar órdenes de trabajo** con notas generadas por IA.

---

## 2. Tecnologías Utilizadas

| Categoría       | Tecnología                                                      |
| --------------- | --------------------------------------------------------------- |
| **Framework**   | Next.js 16.0 (App Router, React Server Components)              |
| **UI**          | React 19, Tailwind CSS 4, Radix UI primitives                   |
| **IA**          | Vercel AI SDK v5, GROQ (Llama 3.3 70B), Google Gemini 2.5 Flash |
| **Lenguaje**    | TypeScript 5 (strict mode)                                      |
| **Validación**  | Zod                                                             |
| **Iconos**      | Lucide React                                                    |
| **Animaciones** | Motion (Framer Motion)                                          |
| **Markdown**    | Streamdown, Shiki (syntax highlighting)                         |
| **Tokens**      | TokenLens (conteo de tokens)                                    |
| **Testing**     | Vitest, Testing Library, MSW (mocks)                            |
| **Linting**     | ESLint 9, Prettier, Husky, Commitlint                           |
| **Bundling**    | PostCSS, @next/bundle-analyzer                                  |

---

## 3. Estructura de Carpetas

```
gima-ai-chatbot/
├── app/                          # ← Núcleo de la aplicación (Next.js App Router)
│   ├── layout.tsx                #    Layout principal (HTML, fuentes, providers)
│   ├── page.tsx                  #    Página principal → carga el Chat dinámicamente
│   ├── globals.css               #    Estilos globales con Tailwind CSS 4
│   ├── favicon.ico               #    Ícono del sitio
│   │
│   ├── api/                      # ── Rutas de API (backend)
│   │   └── chat/
│   │       ├── route.ts          #    POST /api/chat → streaming de IA
│   │       └── __tests__/        #    Tests del endpoint
│   │
│   ├── actions/                  # ── Server Actions (funciones del servidor)
│   │   ├── index.ts              #    Re-exportación centralizada
│   │   ├── voice.ts              #    Transcripción de audio → texto
│   │   ├── vision.ts             #    Análisis de imágenes con Gemini Vision
│   │   ├── files.ts              #    Procesamiento de archivos (PDFs)
│   │   ├── checklist.ts          #    Generación de checklists con IA
│   │   ├── activity-summary.ts   #    Generación de resúmenes de actividades
│   │   ├── data-transformation.ts#    Transformación de datos con IA
│   │   └── __tests__/            #    Tests de server actions
│   │
│   ├── config/                   # ── Configuración del sistema
│   │   ├── index.ts              #    Re-exporta models + server
│   │   ├── env.ts                #    Validación de variables de entorno (Zod)
│   │   ├── features.ts           #    Feature flags con rollout gradual
│   │   ├── limits.ts             #    Límites de tamaño (audio, imagen, PDF, mensajes)
│   │   ├── models.ts             #    Modelos de IA disponibles
│   │   ├── server.ts             #    Prompts del sistema (chat, voz, inventario)
│   │   ├── voice-command-prompt.ts #  Prompt para comandos de voz
│   │   ├── voice-master-prompt.ts  #  Prompt maestro de voz
│   │   ├── prompts/              #    Prompts por herramienta
│   │   │   ├── activity-summary-generation.ts
│   │   │   ├── checklist-generation.ts
│   │   │   └── closeout-generation.ts
│   │   └── __tests__/            #    Tests de configuración
│   │
│   ├── constants/                # ── Constantes globales
│   │   ├── ai.ts                 #    Constantes del sistema IA
│   │   └── messages.ts           #    Mensajes de error/éxito estándar
│   │
│   ├── hooks/                    # ── Custom React Hooks
│   │   ├── use-file-upload.ts    #    Gestión de subida de archivos
│   │   ├── use-keyboard-shortcuts.ts # Atajos de teclado
│   │   ├── use-persistent-chat.ts #   Chat con localStorage persistente
│   │   ├── use-toast.ts          #    Sistema de notificaciones toast
│   │   ├── use-voice-input.ts    #    Grabación y transcripción de voz
│   │   ├── use-work-order-commands.ts # Comandos de voz para OTs
│   │   └── __tests__/            #    Tests de hooks
│   │
│   ├── lib/                      # ── Lógica de negocio y servicios
│   │   ├── utils.ts              #    Utilidad cn() para clases CSS
│   │   ├── logger.ts             #    Sistema de logging estructurado
│   │   ├── errors.ts             #    Manejo centralizado de errores
│   │   ├── analytics.ts          #    Sistema de analíticas
│   │   ├── chat-utils.ts         #    Utilidades del chat
│   │   ├── ip-utils.ts           #    Extracción de IP del cliente
│   │   ├── prompt-sanitizer.ts   #    Sanitización de prompts (seguridad)
│   │   ├── rate-limiter.ts       #    Rate limiting por IP
│   │   │
│   │   ├── ai/                   #    Servicios de IA
│   │   │   ├── base-ai-service.ts #   Clase abstracta base (retry, cache, timeout)
│   │   │   └── tools/
│   │   │       ├── chat-tools.ts  #   Definición de herramientas del chat
│   │   │       └── tool-types.ts  #   Tipos para herramientas
│   │   │
│   │   ├── schemas/              #    Esquemas de validación Zod
│   │   │   ├── index.ts          #    Re-exportación
│   │   │   ├── chat.ts           #    Schema de mensajes de chat
│   │   │   ├── backend-response.schema.ts  # Respuestas del backend GIMA
│   │   │   ├── activity-summary.schema.ts  # Resúmenes de actividades
│   │   │   ├── checklist.schema.ts         # Checklists de mantenimiento
│   │   │   ├── data-transformation.schema.ts # Transformación de datos
│   │   │   └── work-order-closeout.schema.ts # Cierre de órdenes
│   │   │
│   │   ├── services/             #    Servicios de negocio
│   │   │   ├── chat-service.ts   #    Servicio principal del chat
│   │   │   ├── backend-api-service.ts     # Cliente del API backend GIMA
│   │   │   ├── work-order-service.ts      # Servicio de órdenes de trabajo
│   │   │   ├── voice-command-parser.ts    # Parser de comandos de voz
│   │   │   ├── activity-summary-ai-service.ts  # IA para resúmenes
│   │   │   ├── checklist-ai-service.ts    # IA para checklists
│   │   │   ├── work-order-closeout-ai-service.ts # IA para cierre de OTs
│   │   │   ├── contracts/
│   │   │   │   └── work-order-service.contracts.ts # Contratos/interfaces
│   │   │   ├── *.test.ts         #    Tests de servicios
│   │   │   └── __tests__/        #    Tests adicionales
│   │   │
│   │   └── validation/
│   │       └── file-validation.ts #   Validación de archivos subidos
│   │
│   ├── types/                    # ── Definiciones de tipos TypeScript
│   │   ├── chat.types.ts         #    Tipos del sistema de chat
│   │   ├── voice-commands.ts     #    Tipos de comandos de voz
│   │   ├── work-order-validation.ts # Tipos de validación de OTs
│   │   └── __tests__/            #    Tests de tipos
│   │
│   ├── utils/                    # ── Utilidades auxiliares
│   │   ├── base64.ts             #    Codificación/decodificación base64
│   │   └── media-types.ts        #    Detección de tipos de media
│   │
│   ├── tools/                    # ── Páginas de herramientas IA (rutas)
│   │   ├── page.tsx              #    Dashboard de herramientas IA
│   │   ├── activity-summaries/   #    /tools/activity-summaries
│   │   ├── checklist-builder/    #    /tools/checklist-builder
│   │   ├── data-transformation/  #    /tools/data-transformation
│   │   ├── image-upload-test/    #    /tools/image-upload-test
│   │   └── pdf-upload-test/      #    /tools/pdf-upload-test
│   │
│   └── components/               # ── Componentes React
│       ├── ui/                   #    24 componentes base (Radix/shadcn)
│       ├── shared/               #    3 componentes compartidos
│       ├── ai-elements/          #    30 componentes de IA
│       └── features/             #    8 módulos de features
│           ├── chat/             #    Chat principal
│           ├── voice/            #    Entrada de voz
│           ├── ai-tools/         #    Dashboard y componentes shared de tools
│           ├── activity-summary/ #    Resúmenes de actividades
│           ├── checklist-builder/#    Constructor de checklists
│           ├── data-transformation/ # Transformación de datos
│           ├── work-order-closeout/ # Cierre de órdenes de trabajo
│           └── theme/            #    Toggle de tema claro/oscuro
│
├── docs/                         # ── Documentación del proyecto
│   ├── AI_TOOLS_GUIDE.md         #    Guía de herramientas de IA
│   ├── API.md                    #    Documentación de endpoints
│   ├── CONTRIBUTING.md           #    Guía para contribuir
│   ├── RULES.md                  #    Reglas del proyecto
│   ├── ARCHITECTURE-ROADMAP-V04.md # Roadmap de arquitectura
│   ├── Test.md                   #    Documentación de testing
│   ├── workshop-V1.md            #    Workshop del proyecto
│   ├── backend/                  #    Docs del backend GIMA (Laravel)
│   └── studies/                  #    Estudios y análisis
│
├── public/                       # ── Archivos estáticos
│   ├── manifest.json             #    PWA manifest
│   ├── icon-192.png              #    Ícono PWA 192x192
│   ├── icon-512.png              #    Ícono PWA 512x512
│   └── *.svg                     #    Íconos SVG
│
├── tests/                        # ── Tests unitarios e integración
│   ├── setup.msw.ts              #    Setup MSW para mocking de APIs
│   ├── api/                      #    Tests de API
│   ├── config/                   #    Tests de configuración
│   ├── mocks/                    #    Handlers mock de MSW
│   └── performance/              #    Tests de rendimiento
│
├── package.json                  #    Dependencias y scripts
├── next.config.ts                #    Configuración de Next.js
├── tsconfig.json                 #    Configuración TypeScript
├── vitest.config.ts              #    Configuración de Vitest
├── eslint.config.mjs             #    Configuración de ESLint 9
├── postcss.config.mjs            #    PostCSS + Tailwind
├── components.json               #    Configuración shadcn/ui
├── .prettierrc                   #    Configuración Prettier
├── .prettierignore               #    Archivos ignorados por Prettier
├── .gitignore                    #    Archivos ignorados por Git
├── .env.example                  #    Plantilla de variables de entorno
├── .env.local                    #    Variables de entorno locales (NO en Git)
└── README.md                     #    Documentación principal
```

---

## 4. Archivos Raíz

### `package.json`

Define el proyecto **gima-ai-chatbot v0.1.0**. Contiene:

- **Dependencias principales**: Next.js 16, React 19, Vercel AI SDK v5, Radix UI, Tailwind CSS 4, Zod, Motion, Shiki, Lucide, etc.
- **Dependencias de desarrollo**: Vitest, Testing Library, MSW, ESLint 9, Prettier, Husky, Commitlint.
- **Scripts**: `dev`, `build`, `start`, `lint`, `test`, `analyze`, etc.
- **Lint-staged**: Ejecuta ESLint + Prettier en pre-commit.
- **Commitlint**: Fuerza commits convencionales (feat, fix, docs, etc.).

### `next.config.ts`

Configuración del framework Next.js:

- **Server Actions**: Body limit de 5MB (para archivos de audio/imagen).
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy.
- **CSP** (solo producción): Restringe scripts, estilos, imágenes, conexiones y frames.
- **Bundle Analyzer**: Activable con `ANALYZE=true`.

### `tsconfig.json`

TypeScript en modo estricto con path alias `@/` apuntando a `./app/` y `@components/` a `./app/components/`.

### `vitest.config.ts`

Configuración de testing con Vitest: entorno jsdom, soporte React, y cobertura de código.

### `eslint.config.mjs`

Configuración ESLint 9 con reglas de Next.js, accesibilidad (jsx-a11y), y Prettier.

### `components.json`

Configuración de shadcn/ui para generar componentes con Tailwind CSS y aliases correctos.

---

## 5. app/ — Núcleo de la Aplicación

### 5.1 Punto de Entrada

#### `layout.tsx`

**Layout raíz** de toda la aplicación. Responsabilidades:

- Carga las fuentes **Geist Sans** y **Geist Mono** desde Google Fonts.
- Configura metadata SEO (título, descripción, keywords, PWA manifest).
- Envuelve la app en `ErrorBoundary` (captura errores globalmente) y `ToastProvider` (notificaciones).
- Define el idioma como `es` (español).
- Configura viewport mobile-first con zoom deshabilitado.

#### `page.tsx`

**Página principal** que renderiza el componente `Chat`. Usa `dynamic()` de Next.js para cargarlo de forma **lazy** sin SSR (Server-Side Rendering), ya que el chat depende del navegador (`localStorage`, `fetch`, etc.).

### 5.2 Estilos Globales

#### `globals.css`

Estilos globales con **Tailwind CSS 4**. Define:

- Variables CSS para colores del tema claro y oscuro.
- Integración con tw-animate-css para animaciones.
- Estilos base y utilidades personalizadas.

---

### 5.3 api/ — Rutas de API

#### `api/chat/route.ts`

**Endpoint POST `/api/chat`** — El corazón del sistema de chat. Flujo:

1. **Valida la IP del cliente** para rate limiting.
2. **Parsea el body JSON** del request.
3. **Delega al `ChatService`** que procesa el mensaje con IA.
4. **Retorna un stream** de la respuesta de IA al cliente.
5. **Maneja errores**: Rate limit (429), validación (400), o error interno (500).

Configuración: `maxDuration = 30s` para compatibilidad con Vercel Functions.

---

### 5.4 actions/ — Server Actions

Server Actions de Next.js que ejecutan lógica en el servidor sin necesidad de endpoints API separados.

| Archivo                  | Función                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `index.ts`               | Re-exporta todas las actions para imports centralizados           |
| `voice.ts`               | Envía audio a Gemini para transcripción de voz → texto            |
| `vision.ts`              | Envía imagen a Gemini Vision para análisis de piezas industriales |
| `files.ts`               | Procesa y valida archivos PDF para extracción de contenido        |
| `checklist.ts`           | Genera checklists de mantenimiento con IA                         |
| `activity-summary.ts`    | Genera resúmenes profesionales de actividades con IA              |
| `data-transformation.ts` | Transforma y valida datos usando IA generativa                    |

**¿Cómo funcionan?** Son funciones `async` marcadas con `'use server'` que se invocan directamente desde componentes React. Next.js las serializa automáticamente como llamadas HTTP internas.

---

### 5.5 config/ — Configuración

Módulo de configuración centralizada. Todo el sistema lee sus ajustes desde aquí.

#### `env.ts` — Variables de Entorno

Valida todas las variables de entorno con **Zod** al iniciar la app:

- `GROQ_API_KEY`: Opcional, debe empezar con `gsk_`.
- `GOOGLE_GENERATIVE_AI_API_KEY`: Opcional, debe empezar con `AIza`.
- `NODE_ENV`: development / production / test.
- `NEXT_PUBLIC_BACKEND_API_URL`: URL del backend GIMA (Laravel).
- `NEXT_PUBLIC_DEMO_MODE`: Modo demo sin backend.

Si alguna variable es inválida, la app **falla inmediatamente** con un error descriptivo.

#### `features.ts` — Feature Flags

Sistema completo de **feature flags** con rollout gradual:

- `voiceCommands`: Comandos de voz (25% rollout).
- `pdfReader`: Lector de PDFs (0% rollout, solo allowlist).

Funciones: `isFeatureEnabled()`, `areAllFeaturesEnabled()`, `getServerFeatureState()`.
Usa un hash del email del usuario para distribución consistente del rollout.

#### `limits.ts` — Límites de Tamaño

Constantes centralizadas para todo el sistema:

- Audio: máx 5MB.
- Imágenes: máx 5MB.
- PDFs: máx 10MB.
- Mensajes: máx 10KB (~5000 palabras).
- Historial: máx 100 mensajes en localStorage.

#### `models.ts` — Modelos de IA

Define los modelos disponibles:

- **Llama 3.3 70B Versatile** (GROQ) — Modelo predeterminado para chat.

#### `server.ts` — Prompts del Sistema

Contiene los prompts principales inyectados a los modelos de IA:

- **SYSTEM_PROMPT**: Personalidad y reglas del asistente GIMA.
- **VOICE_PROMPT**: Instrucciones para transcripción de voz.
- **INVENTORY_PROMPT**: Instrucciones para análisis de imágenes de piezas.
- **STREAM_CONFIG**: `maxDuration: 30s`.
- **ACRONYMS_GLOSSARY**: Diccionario de siglas técnicas de la UNEG (UMA, BCA, TAB, ST, etc.).

#### `voice-command-prompt.ts` y `voice-master-prompt.ts`

Prompts especializados para la interpretación de comandos de voz y su conversión en acciones sobre órdenes de trabajo.

#### `prompts/`

Prompts dedicados para cada herramienta de IA:

- `activity-summary-generation.ts`: Prompt para generar resúmenes de actividades.
- `checklist-generation.ts`: Prompt para generar checklists de mantenimiento.
- `closeout-generation.ts`: Prompt para generar notas de cierre de OTs.

---

### 5.6 constants/ — Constantes

| Archivo       | Contenido                                                              |
| ------------- | ---------------------------------------------------------------------- |
| `ai.ts`       | Constantes del sistema de IA (IDs de modelo, configuraciones estándar) |
| `messages.ts` | Mensajes de error y éxito estandarizados (RATE_LIMIT, UNKNOWN, etc.)   |

---

### 5.7 hooks/ — Custom React Hooks

Hooks reutilizables que encapsulan lógica de estado compleja:

| Hook                         | Funcionalidad                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-persistent-chat.ts`     | Chat con persistencia en `localStorage`. Gestiona mensajes, modelo seleccionado, y sincronización. Configurable con `enablePersistence`.                       |
| `use-voice-input.ts`         | Grabación de audio con `MediaRecorder`, envío a Gemini para transcripción, y fallback a Web Speech API. Maneja estados de grabación, procesamiento, y errores. |
| `use-file-upload.ts`         | Validación, preview y gestión de archivos subidos (imágenes, PDFs).                                                                                            |
| `use-keyboard-shortcuts.ts`  | Atajos de teclado globales para la interfaz del chat.                                                                                                          |
| `use-toast.ts`               | Wrapper del sistema de notificaciones toast.                                                                                                                   |
| `use-work-order-commands.ts` | Interpreta comandos de voz y los convierte en acciones de órdenes de trabajo (crear, listar, asignar).                                                         |

---

### 5.8 lib/ — Lógica de Negocio

La capa más importante del proyecto. Contiene toda la lógica que no es de UI.

#### Utilidades Core

| Archivo               | Función                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `utils.ts`            | Función `cn()` para combinar clases CSS con `clsx` + `tailwind-merge`.                        |
| `logger.ts`           | Logger estructurado con niveles (info, warn, error). Incluye contexto (componente, acción).   |
| `errors.ts`           | Sistema centralizado de manejo de errores: clasificación, formateo, y recovery.               |
| `analytics.ts`        | Sistema de analíticas para tracking de eventos del chat y herramientas.                       |
| `chat-utils.ts`       | Utilidades para manipulación de mensajes del chat.                                            |
| `ip-utils.ts`         | Extracción de IP del cliente desde headers HTTP (para rate limiting).                         |
| `prompt-sanitizer.ts` | Sanitización de prompts del usuario para prevenir inyección de prompts y contenido malicioso. |
| `rate-limiter.ts`     | Rate limiting en memoria por IP con ventana deslizante.                                       |

#### `lib/ai/` — Servicios de IA

##### `base-ai-service.ts`

**Clase abstracta `BaseAIService`** — Base para todos los servicios de IA. Proporciona:

- **Retry con backoff exponencial**: Reintenta automáticamente en timeouts y errores de red.
- **Cache de respuestas**: Evita llamadas duplicadas a la IA.
- **Validación con Zod**: Valida inputs y outputs con schemas.
- **Timeout configurable**: 30s por defecto.
- **Logging estructurado**: Registra cada operación con correlationId.
- **Errores tipados**: `AIServiceError`, `AITimeoutError`, `AIValidationError`.

##### `lib/ai/tools/chat-tools.ts`

Define las **herramientas del chat** que la IA puede invocar automáticamente durante conversaciones:

- Consultar activos del sistema GIMA.
- Buscar órdenes de trabajo.
- Consultar inventario.
- Crear/actualizar registros.

##### `lib/ai/tools/tool-types.ts`

Tipos TypeScript para las herramientas del chat.

#### `lib/schemas/` — Esquemas de Validación Zod

Esquemas que definen la estructura exacta de los datos en toda la app:

| Schema                          | Qué valida                                      |
| ------------------------------- | ----------------------------------------------- |
| `chat.ts`                       | Mensajes de chat (roles, contenido, imágenes)   |
| `backend-response.schema.ts`    | Respuestas paginadas del backend GIMA (Laravel) |
| `activity-summary.schema.ts`    | Estructura de resúmenes de actividades          |
| `checklist.schema.ts`           | Estructura de checklists de mantenimiento       |
| `data-transformation.schema.ts` | Estructura de datos transformados               |
| `work-order-closeout.schema.ts` | Estructura de notas de cierre de OTs            |

#### `lib/services/` — Servicios de Negocio

El motor del proyecto. Cada servicio encapsula una funcionalidad completa:

| Servicio                                    | Responsabilidad                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `chat-service.ts`                           | Orquesta el flujo del chat: validación → rate limit → streaming de IA. Exporta `ChatService`, `RateLimitError`, `ValidationError`. |
| `backend-api-service.ts`                    | Cliente HTTP para el backend GIMA (Laravel). Gestiona autenticación, paginación, y errores de red.                                 |
| `work-order-service.ts`                     | CRUD de órdenes de trabajo. Interactúa con el backend para crear, listar, actualizar y cerrar OTs.                                 |
| `voice-command-parser.ts`                   | Parsea comandos de voz naturales y los convierte en acciones estructuradas.                                                        |
| `activity-summary-ai-service.ts`            | Extiende `BaseAIService`. Genera resúmenes de actividades usando IA con prompts especializados.                                    |
| `checklist-ai-service.ts`                   | Extiende `BaseAIService`. Genera checklists de mantenimiento con IA.                                                               |
| `work-order-closeout-ai-service.ts`         | Extiende `BaseAIService`. Genera notas de cierre profesionales para OTs.                                                           |
| `contracts/work-order-service.contracts.ts` | Interfaces y contratos (types) del servicio de órdenes de trabajo.                                                                 |

#### `lib/validation/file-validation.ts`

Validación de archivos subidos: tipo MIME, tamaño, y extensión permitida.

---

### 5.9 types/ — Tipos TypeScript

| Archivo                    | Contenido                                                             |
| -------------------------- | --------------------------------------------------------------------- |
| `chat.types.ts`            | Tipos del sistema de chat (mensajes, attachments, etc.)               |
| `voice-commands.ts`        | Tipos para el sistema de comandos de voz (acciones, estados, preview) |
| `work-order-validation.ts` | Tipos para la validación de datos de órdenes de trabajo               |

---

### 5.10 utils/ — Utilidades

| Archivo          | Función                                                      |
| ---------------- | ------------------------------------------------------------ |
| `base64.ts`      | Funciones para codificar/decodificar datos en base64         |
| `media-types.ts` | Detección de tipos MIME y extensiones de archivos multimedia |

---

### 5.11 tools/ — Páginas de Herramientas IA

Rutas de Next.js para cada herramienta de IA. Cada carpeta contiene un `page.tsx`:

| Ruta                         | Herramienta                                |
| ---------------------------- | ------------------------------------------ |
| `/tools`                     | Dashboard con todas las herramientas       |
| `/tools/activity-summaries`  | Generador de resúmenes de actividades      |
| `/tools/checklist-builder`   | Constructor de checklists de mantenimiento |
| `/tools/data-transformation` | Transformador de datos con IA              |
| `/tools/image-upload-test`   | Página de prueba para subida de imágenes   |
| `/tools/pdf-upload-test`     | Página de prueba para subida de PDFs       |

---

### 5.12 components/ — Componentes React

La UI está organizada en 4 capas con separación clara de responsabilidades:

#### `components/ui/` — 24 Componentes Base (Primitivos)

Componentes genéricos basados en **Radix UI** + **shadcn/ui**. Son bloques de construcción reutilizables sin lógica de negocio:

| Componente          | Descripción                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `button.tsx`        | Botón con variantes (default, destructive, outline, ghost, link) |
| `button-group.tsx`  | Grupo de botones relacionados                                    |
| `input.tsx`         | Campo de texto                                                   |
| `textarea.tsx`      | Campo de texto multilínea                                        |
| `input-group.tsx`   | Input con ícono y label integrados                               |
| `label.tsx`         | Etiqueta de formulario                                           |
| `checkbox.tsx`      | Casilla de verificación                                          |
| `select.tsx`        | Menú desplegable de selección                                    |
| `dialog.tsx`        | Modal/diálogo                                                    |
| `dropdown-menu.tsx` | Menú desplegable contextual                                      |
| `card.tsx`          | Tarjeta con header, contenido y footer                           |
| `badge.tsx`         | Etiqueta/badge decorativo                                        |
| `alert.tsx`         | Mensaje de alerta informativo                                    |
| `tooltip.tsx`       | Tooltip al hacer hover                                           |
| `hover-card.tsx`    | Tarjeta emergente al hover                                       |
| `toast.tsx`         | Notificaciones temporales                                        |
| `sonner.tsx`        | Notificaciones con Sonner                                        |
| `progress.tsx`      | Barra de progreso                                                |
| `skeleton.tsx`      | Placeholder de carga animado                                     |
| `scroll-area.tsx`   | Área de scroll personalizada                                     |
| `separator.tsx`     | Línea separadora                                                 |
| `collapsible.tsx`   | Sección colapsable                                               |
| `carousel.tsx`      | Carrusel de contenido (Embla)                                    |
| `command.tsx`       | Paleta de comandos (tipo Spotlight/Cmd+K)                        |

#### `components/shared/` — 3 Componentes Compartidos

Componentes de alto nivel reutilizados en múltiples features:

| Componente           | Función                                               |
| -------------------- | ----------------------------------------------------- |
| `error-boundary.tsx` | Captura errores de React y muestra fallback amigable  |
| `confirm-dialog.tsx` | Dialog de confirmación genérico (sí/no)               |
| `feature-guard.tsx`  | Guard que muestra/oculta features según feature flags |

#### `components/ai-elements/` — 30 Componentes de IA

Componentes especializados para rendering de contenido generado por IA:

| Componente             | Función                                                 |
| ---------------------- | ------------------------------------------------------- |
| `message.tsx`          | Renderiza un mensaje de chat (usuario o asistente)      |
| `conversation.tsx`     | Contenedor de la conversación completa                  |
| `prompt-input.tsx`     | Campo de entrada del chat con funcionalidades avanzadas |
| `model-selector.tsx`   | Selector del modelo de IA                               |
| `code-block.tsx`       | Bloque de código con syntax highlighting (Shiki)        |
| `reasoning.tsx`        | Muestra el razonamiento step-by-step de la IA           |
| `chain-of-thought.tsx` | Visualización de la cadena de pensamiento               |
| `tool.tsx`             | Renderiza resultados de invocación de herramientas      |
| `confirmation.tsx`     | Diálogo de confirmación para acciones de la IA          |
| `plan.tsx`             | Muestra planes de acción generados por la IA            |
| `task.tsx`             | Renderiza tareas individuales de un plan                |
| `loader.tsx`           | Indicador de carga animado de la IA                     |
| `shimmer.tsx`          | Efecto shimmer mientras la IA genera respuesta          |
| `suggestion.tsx`       | Sugerencias de preguntas rápidas                        |
| `sources.tsx`          | Lista de fuentes citadas por la IA                      |
| `inline-citation.tsx`  | Cita inline dentro del texto generado                   |
| `artifact.tsx`         | Renderiza artefactos generados (código, documentos)     |
| `web-preview.tsx`      | Preview de contenido web referenciado                   |
| `open-in-chat.tsx`     | Botón para abrir contenido en el chat principal         |
| `queue.tsx`            | Cola de mensajes pendientes                             |
| `context.tsx`          | Proveedor de contexto para componentes IA               |
| `image.tsx`            | Renderiza imágenes en mensajes                          |
| `canvas.tsx`           | Canvas interactivo (React Flow)                         |
| `node.tsx`             | Nodo de diagrama (React Flow)                           |
| `edge.tsx`             | Conexión entre nodos (React Flow)                       |
| `connection.tsx`       | Líneas de conexión en canvas                            |
| `controls.tsx`         | Controles del canvas                                    |
| `panel.tsx`            | Panel lateral del canvas                                |
| `toolbar.tsx`          | Barra de herramientas del canvas                        |
| `checkpoint.tsx`       | Punto de control en la conversación                     |

#### `components/features/` — 8 Módulos de Features

Cada feature es un módulo autocontenido con su UI, hooks, tipos y constantes:

---

##### `features/chat/` — Chat Principal

El módulo más grande. Renderiza la interfaz completa del chat.

| Archivo                     | Función                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `chat.tsx`                  | Componente raíz. Orquesta todos los sub-componentes del chat.     |
| `index.ts`                  | Re-exporta `Chat` y tipos públicos.                               |
| `chat-header.tsx`           | Barra superior con título, selector de modelo, y acciones.        |
| `chat-conversation.tsx`     | Lista de mensajes con auto-scroll y skeleton loading.             |
| `chat-message.tsx`          | Renderiza un mensaje individual con avatar, markdown, y acciones. |
| `chat-input-area.tsx`       | Área de entrada con textarea, botones de voz, adjuntar, enviar.   |
| `chat-empty-state.tsx`      | Estado vacío con sugerencias de preguntas rápidas.                |
| `chat-quick-actions.tsx`    | Acciones rápidas en el chat (limpiar, exportar, etc.).            |
| `chat-status-bar.tsx`       | Barra de estado (modelo activo, tokens, conexión).                |
| `chat-help.tsx`             | Panel de ayuda con documentación in-app.                          |
| `chat-message-skeleton.tsx` | Skeleton animado mientras carga un mensaje.                       |
| `tool-result-cards.tsx`     | Tarjetas de resultados de herramientas IA (Generative UI).        |
| `constants.ts`              | Constantes del chat (IDs, timeouts, límites visuales).            |
| `utils.ts`                  | Utilidades internas del chat.                                     |

**Subdirectorios:**

- `hooks/`: 5 hooks especializados del chat:
  - `use-chat-actions.ts` — Acciones del menú del chat (copiar, regenerar).
  - `use-chat-keyboard.ts` — Atajos de teclado (Enter para enviar, Shift+Enter nueva línea).
  - `use-chat-submit.ts` — Lógica de envío del mensaje al API.
  - `use-file-submission.ts` — Envío de archivos adjuntos con optimistic UI.
  - `use-image-analysis.ts` — Análisis de imágenes con Gemini Vision.

- `types/`: 5 archivos de tipos:
  - `component.types.ts` — Props de componentes del chat.
  - `hook.types.ts` — Tipos de retorno de hooks.
  - `message.types.ts` — Tipos de mensajes extendidos.
  - `voice-props.types.ts` — Props para componentes de voz.

---

##### `features/voice/` — Entrada de Voz

Sistema de voz con grabación, transcripción y comandos:

| Archivo                        | Función                                             |
| ------------------------------ | --------------------------------------------------- |
| `voice-button.tsx`             | Botón principal de grabación de voz                 |
| `voice-command-mode.tsx`       | Modo de comandos de voz para órdenes de trabajo     |
| `command-preview.tsx`          | Preview del comando interpretado antes de confirmar |
| `command-status-indicator.tsx` | Indicador visual del estado del comando             |
| `audio-waveform.tsx`           | Visualización de la forma de onda del audio         |
| `constants.ts`                 | Constantes del sistema de voz                       |
| `types.ts`                     | Tipos del módulo de voz                             |
| `index.ts`                     | Re-exportaciones públicas                           |
| `hooks/`                       | 3 hooks especializados de voz                       |

---

##### `features/ai-tools/` — Dashboard de Herramientas IA

| Archivo                 | Función                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `dashboard.tsx`         | Dashboard principal con tarjetas de todas las herramientas |
| `image-upload-test.tsx` | Componente de prueba para subida de imágenes               |
| `pdf-upload-test.tsx`   | Componente de prueba para subida de PDFs                   |

**`shared/`** — Componentes compartidos entre herramientas:

| Componente               | Función                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `ai-tool-layout.tsx`     | Layout estándar para todas las herramientas (título, breadcrumbs) |
| `ai-generation-form.tsx` | Formulario genérico de generación con IA                          |
| `ai-history-list.tsx`    | Lista de generaciones previas con historial                       |
| `ai-preview-card.tsx`    | Tarjeta de preview de contenido generado                          |
| `ai-status-badge.tsx`    | Badge de estado (generando, completado, error)                    |
| `ai-usage-stats.tsx`     | Estadísticas de uso de la herramienta                             |
| `types.ts`               | Tipos compartidos de herramientas                                 |

---

##### `features/activity-summary/` — Resúmenes de Actividades

Genera resúmenes profesionales de actividades de mantenimiento:

| Archivo                        | Función                                     |
| ------------------------------ | ------------------------------------------- |
| `activity-summary.tsx`         | Componente principal orquestador            |
| `activity-summary-form.tsx`    | Formulario de entrada de datos de actividad |
| `activity-summary-preview.tsx` | Preview del resumen generado                |
| `activity-summary-list.tsx`    | Lista de resúmenes generados previamente    |
| `constants.ts`, `types.ts`     | Constantes y tipos del módulo               |
| `hooks/`                       | 5 hooks especializados                      |

---

##### `features/checklist-builder/` — Constructor de Checklists

Genera checklists de mantenimiento personalizados con IA:

| Archivo                         | Función                                   |
| ------------------------------- | ----------------------------------------- |
| `checklist-builder.tsx`         | Componente principal                      |
| `checklist-builder-form.tsx`    | Formulario para describir el equipo/tarea |
| `checklist-builder-preview.tsx` | Preview del checklist generado            |
| `checklist-builder-list.tsx`    | Historial de checklists                   |
| `constants.ts`, `types.ts`      | Constantes y tipos                        |
| `hooks/`                        | 5 hooks especializados                    |

---

##### `features/data-transformation/` — Transformación de Datos

Transforma datos no estructurados en formatos útiles con IA:

| Archivo                           | Función                               |
| --------------------------------- | ------------------------------------- |
| `data-transformation.tsx`         | Componente principal                  |
| `data-transformation-form.tsx`    | Formulario de entrada de datos brutos |
| `data-transformation-preview.tsx` | Preview de los datos transformados    |
| `data-history-view.tsx`           | Historial de transformaciones         |
| `constants.ts`, `types.ts`        | Constantes y tipos                    |
| `hooks/`                          | 3 hooks especializados                |

---

##### `features/work-order-closeout/` — Cierre de Órdenes de Trabajo

Genera notas de cierre profesionales para órdenes de trabajo:

| Archivo                     | Función                                 |
| --------------------------- | --------------------------------------- |
| `closeout-notes-modal.tsx`  | Modal completo con formulario y preview |
| `closeout-notes-button.tsx` | Botón que abre el modal de cierre       |
| `constants.ts`, `types.ts`  | Constantes y tipos                      |
| `hooks/`                    | 5 hooks especializados                  |

---

##### `features/theme/` — Toggle de Tema

| Archivo            | Función                                      |
| ------------------ | -------------------------------------------- |
| `theme-toggle.tsx` | Botón para cambiar entre tema claro y oscuro |
| `constants.ts`     | Constantes del tema (colores, modos)         |
| `types.ts`         | Tipos del sistema de temas                   |

---

## 6. Flujo de Datos (Arquitectura)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                        │
│                                                                 │
│  page.tsx ─→ Chat ─→ usePersistentChat ─→ localStorage         │
│                │                                                │
│                ├─→ ChatInputArea ─→ fetch('/api/chat')          │
│                │                     ↓                          │
│                ├─→ VoiceButton ──→ Server Action: voice.ts      │
│                │                     ↓ Gemini Audio API         │
│                ├─→ FileUpload ───→ Server Action: vision.ts     │
│                │                     ↓ Gemini Vision API        │
│                └─→ ToolResultCards (Generative UI)              │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVIDOR (Next.js)                         │
│                                                                 │
│  api/chat/route.ts                                              │
│    ↓                                                            │
│  ChatService ──→ Rate Limiter ──→ Prompt Sanitizer              │
│    ↓                                                            │
│  Vercel AI SDK (streamText)                                     │
│    ├─→ GROQ (Llama 3.3 70B) ← Chat principal                   │
│    └─→ Google Gemini 2.5 Flash ← Vision, Voz, Tools            │
│    ↓                                                            │
│  AI Tools ──→ BackendApiService ──→ Backend GIMA (Laravel)      │
│                                                                 │
│  Server Actions (actions/*.ts)                                  │
│    ├─→ ActivitySummaryAIService ← BaseAIService                 │
│    ├─→ ChecklistAIService ← BaseAIService                      │
│    └─→ WorkOrderCloseoutAIService ← BaseAIService              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de un Mensaje de Chat

1. El usuario escribe en `ChatInputArea` y presiona Enter.
2. `use-chat-submit` envía el mensaje vía `fetch` a `POST /api/chat`.
3. `route.ts` extrae la IP, valida el body, y crea un `ChatService`.
4. `ChatService` aplica rate limiting, sanitiza el prompt, y llama a `streamText()` del AI SDK.
5. El AI SDK se conecta a GROQ con el modelo seleccionado y el `SYSTEM_PROMPT`.
6. Si la IA invoca una herramienta (tool call), `chat-tools.ts` ejecuta la acción y retorna el resultado.
7. La respuesta se streamed de vuelta al cliente.
8. `usePersistentChat` actualiza el estado y guarda en `localStorage`.

### Flujo de Análisis de Imagen

1. El usuario adjunta una imagen en `ChatInputArea`.
2. `use-file-submission` valida la imagen y la convierte a base64.
3. Se invoca la Server Action `vision.ts`.
4. `vision.ts` envía la imagen a Gemini Vision API con el `INVENTORY_PROMPT`.
5. Gemini retorna un JSON estructurado + resumen legible.
6. El resultado se muestra en el chat como mensaje del asistente.

### Flujo de Comando de Voz

1. El usuario presiona `VoiceButton` y habla.
2. `use-voice-input` graba audio con `MediaRecorder`.
3. Al terminar, invoca la Server Action `voice.ts`.
4. `voice.ts` envía el audio a Gemini con el `VOICE_PROMPT`.
5. La transcripción se inserta en el campo de entrada o se procesa como comando de voz.
6. Si es un comando, `use-work-order-commands` parsea la acción y muestra un preview.

---

## 7. Modelos de IA

| Proveedor  | Modelo                  | Uso Principal                            |
| ---------- | ----------------------- | ---------------------------------------- |
| **GROQ**   | Llama 3.3 70B Versatile | Chat conversacional, generación de texto |
| **Google** | Gemini 2.5 Flash        | Análisis de imágenes, extracción de PDFs |
| **Google** | Gemini 2.5 Flash Lite   | Transcripción de voz, comandos           |

---

## 8. Variables de Entorno

Crear archivo `.env.local` basado en `.env.example`:

```env
# API Keys (al menos una requerida)
GROQ_API_KEY=gsk_...                        # Para chat con Llama 3.3
GOOGLE_GENERATIVE_AI_API_KEY=AIza...        # Para vision, voz, y herramientas

# Entorno
NODE_ENV=development

# Backend GIMA (opcional)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api
BACKEND_API_KEY=
NEXT_PUBLIC_DEMO_MODE=false

# Feature Flags (opcional)
NEXT_PUBLIC_FEATURE_VOICE_COMMANDS=false
NEXT_PUBLIC_FEATURE_PDF_READER=false
```

> ⚠️ **Nota Windows**: El archivo `.env.local` debe estar en codificación **UTF-8**. Si está en UTF-16, Next.js no podrá leer las variables y lanzará un `ZodError`.

---

## 9. Scripts Disponibles

```bash
pnpm run dev          # Servidor de desarrollo (localhost:3000)
pnpm run build        # Build de producción
pnpm run start        # Servidor de producción
pnpm run lint         # Ejecutar ESLint
pnpm run lint:fix     # Corregir errores de ESLint automáticamente
pnpm run format       # Formatear código con Prettier
pnpm run type-check   # Verificar tipos TypeScript
pnpm test             # Ejecutar tests con Vitest
pnpm run test:ui      # UI interactiva de tests
pnpm run test:coverage # Reporte de cobertura de código
pnpm run analyze      # Analizar bundle de producción
```

---

> **Desarrollado con IA para GIMA — Sistema de Gestión Integral de Mantenimiento y Activos de la UNEG.**
