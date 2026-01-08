# GIMA AI Chatbot

Asistente inteligente para la gestión de mantenimiento y activos de la Universidad Nacional Experimental de Guayana (UNEG).

## 🚀 Características

- **Chat multimodal**: Texto, voz e imágenes
- **Análisis automático de piezas** con IA (Gemini Vision)
- **Lector de PDFs**: Análisis y resumen de documentos PDF (manuales, reportes)
- **Transcripción de voz** inteligente con Gemini API + fallback nativo Web Speech API
- **Comandos de voz** para órdenes de trabajo (crear, consultar, asignar)
- **Múltiples modelos de IA**: GROQ (Llama, Mixtral) + Google Gemini
- **Persistencia de historial** configurable en navegador (localStorage)
- **Interfaz responsiva** con React 19 y Tailwind CSS 4

## 🎤 Comandos de Voz

El sistema permite crear órdenes de trabajo usando comandos de voz naturales.

### Acciones Disponibles

| Comando Ejemplo                                | Acción                    |
| ---------------------------------------------- | ------------------------- |
| "Crear orden urgente para la UMA del sector 3" | Crea orden de trabajo     |
| "Mostrar órdenes pendientes"                   | Lista órdenes pendientes  |
| "Verificar estado de la BCA"                   | Consulta estado de equipo |
| "Asignar orden al técnico Carlos"              | Asigna técnico            |

### Terminología UNEG Reconocida

- **UMA**: Unidad Manejadora de Aire
- **BCA**: Bomba Centrífuga de Agua
- **TAB**: Tablero de Distribución Eléctrica
- **ST**: Subestación Transformadora

### Uso

1. Click en "🎤 Usar comando de voz para órdenes de trabajo"
2. Habla tu comando de forma clara
3. Revisa el preview del comando interpretado
4. Confirma o reintenta

## 📋 Requisitos

- Node.js 20+ y npm
- API Keys:
  - [GROQ API](https://console.groq.com/)
  - [Google Gemini](https://makersuite.google.com/app/apikey)

## ⚙️ Instalación y Setup

```bash
# Clonar repositorio
git clone <repo-url>
cd gima-ai-chatbot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus API keys

# Ejecutar en modo desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## 🔑 Variables de Entorno

Crear archivo `.env.local` con:

```env
GROQ_API_KEY=gsk_...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
NODE_ENV=development
```

> **⚠️ Importante**: El archivo `.env.local` debe estar guardado con codificación **UTF-8**. Si usas Windows y experimentas errores de "ZodError" al iniciar la app, probablemente el archivo esté en UTF-16. Ver sección [Troubleshooting](#-troubleshooting) para solución.

Ver `.env.example` para referencia completa.

## 🛠️ Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Ejecutar ESLint
npm run lint:fix     # Corregir errores de ESLint
npm run format       # Formatear código con Prettier
npm run type-check   # Verificar tipos TypeScript
```

## 🏗️ Tecnologías

- **Framework**: Next.js 16.0 (App Router)
- **UI**: React 19, Tailwind CSS 4, Radix UI
- **IA**: Vercel AI SDK v5, GROQ, Google Gemini
- **Lenguaje**: TypeScript 5 (strict mode)
- **Validación**: Zod
- **Iconos**: Lucide React

## 📁 Estructura del Proyecto

```
gima-ai-chatbot/
├── app/
│   ├── api/chat/          # API route para chat
│   ├── components/
│   │   ├── ai-elements/   # Componentes de IA
│   │   └── ui/            # Componentes UI
│   ├── config/            # Configuración y prompts
│   ├── hooks/             # React hooks personalizados
│   ├── types/             # Tipos TypeScript
│   └── actions.ts         # Server Actions (Gemini)
├── public/                # Archivos estáticos
└── .env.example           # Plantilla de variables
```

## 🤖 Modelos Disponibles

- **LLaMA 3.3 70B** (predeterminado): Rápido y eficiente
- **Mixtral 8x7B**: Excelente razonamiento
- **LLaMA 3.1 8B**: Ultrarrápido

## 🔒 Seguridad

- Validación de entrada con Zod
- Headers de seguridad HTTP configurados
- Validación estricta de variables de entorno
- TypeScript strict mode activado

## 🛠️ Troubleshooting

### Error: "ZodError - expected string, received undefined" al iniciar

**Causa**: El archivo `.env.local` está en formato UTF-16 en lugar de UTF-8, lo que impide que Next.js lea las variables de entorno.

**Solución (Windows PowerShell)**:

```powershell
# Convertir .env.local a UTF-8
$content = Get-Content .env.local -Raw -Encoding Unicode
[System.IO.File]::WriteAllText((Resolve-Path .env.local), $content, [System.Text.UTF8Encoding]::new($false))
```

**Solución (Manual)**:

1. Abre `.env.local` en VSCode o Notepad++
2. Guarda como → Selecciona "UTF-8" como codificación
3. Reinicia el servidor: `npm run dev`

### Deshabilitar persistencia de localStorage

Por defecto, el chat guarda el historial en localStorage. Para deshabilitar:

```typescript
// En app/components/features/chat/chat.tsx línea 77
const { messages, ... } = usePersistentChat({
  storageKey: 'gima-chat-v1',
  enablePersistence: false  // Deshabilitar persistencia
});
```

Útil para demos, testing, o cuando se requiere sesiones privadas sin historial.

### Los mensajes no aparecen después de subir imagen

Este problema ya fue **solucionado** en versiones recientes. Si aún ocurre:

1. Asegúrate de tener la última versión del código
2. Verifica que `use-file-submission.ts` incluya la actualización que agrega mensajes manualmente al estado
3. Limpia localStorage: `localStorage.clear()` en la consola del navegador

## 📝 Licencia

Proyecto académico - UNEG

---

**Desarrollado con IA para GIMA - Sistema de Gestión Integral de Mantenimiento y Activos**
