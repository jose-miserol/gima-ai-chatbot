# 17 — Types, Utils y Constants

> Estos módulos son "pegamento" que conecta el resto del proyecto: tipos compartidos, utilidades de propósito general, y constantes globales.

---

## 📁 `types/` — Tipos TypeScript Globales

Constituye el directorio principal para cobijar las definiciones de tipos globales de TypeScript que permean y se utilizan transversalmente a lo largo de múltiples módulos del sistema. Existe como una entidad separada de uso común porque estos tipos son compartidos holísticamente; si una firma o interfaz fuera exclusiva de un solo feature, residiría acoplada allí mismo, pero las estructuras fundacionales de chat o comandos residen aquí para evitar colisiones e inconsistencias por duplicados en toda la aplicación.

### `types/chat.types.ts`

Define los tipos del sistema de chat que se usan tanto en el cliente como en el servidor:

- Tipos de mensajes extendidos
- Tipos de attachments (imágenes, archivos)
- Tipos de estados del chat

### `types/voice-commands.ts`

Define los tipos del sistema de comandos de voz:

```typescript
// Acciones posibles de un comando de voz
type VoiceCommandAction =
  | 'create_work_order' // Crear orden de trabajo
  | 'list_work_orders' // Listar órdenes
  | 'check_status' // Verificar estado
  | 'assign_technician'; // Asignar técnico

// Estructura de un comando interpretado
interface VoiceWorkOrderCommand {
  action: VoiceCommandAction;
  equipment?: string; // "UMA", "BCA", etc.
  priority?: string; // "urgente", "normal"
  location?: string; // "sector 3", "edificio B"
  description?: string;
  confidence: number; // 0.0 a 1.0
}
```

### `types/work-order-validation.ts`

Tipos para la validación de datos de órdenes de trabajo antes de enviar al backend.

---

## 📁 `utils/` — Utilidades Auxiliares

### `utils/base64.ts`

```typescript
export function getBase64Size(base64String: string): number {
  // Calcula el tamaño en bytes de un string base64
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}
```

💡 **¿Por qué?** Cuando un usuario sube una imagen, la recibimos como base64. Necesitamos saber el tamaño real en bytes para validar contra el límite (5MB).

🧠 **Concepto**: Base64 codifica datos binarios como texto. Un archivo de 3 bytes se convierte en 4 caracteres base64. Por eso la fórmula es `(length * 3) / 4`.

### `utils/media-types.ts`

```typescript
// Detecta si un MIME type es una imagen
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// Detecta si un MIME type es un PDF
export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

// Detecta si un MIME type es audio
export function isAudioMimeType(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}
```

💡 **¿Para qué?** Cuando el usuario adjunta un archivo, necesitamos saber qué tipo es para decidir qué hacer: imágenes → Gemini Vision, PDFs → Gemini Flash, audio → transcripción.

---

## 📁 `constants/` — Constantes Globales

### `constants/ai.ts`

Constantes relacionadas con el sistema de IA:

- IDs de modelos
- Configuraciones estándar
- Valores por defecto

### `constants/messages.ts`

Mensajes estandarizados para toda la aplicación:

```typescript
export const ERROR_MESSAGES = {
  RATE_LIMIT: 'Has excedido el límite de mensajes. Espera un momento.',
  INVALID_REQUEST: 'Solicitud inválida. Verifica los datos e intenta de nuevo.',
  PROCESSING_ERROR: 'Error al procesar tu solicitud. Intenta de nuevo.',
  UNKNOWN: 'Error desconocido. Contacta al administrador.',
  QUOTA_EXCEEDED_DESCRIPTION: 'Has alcanzado el límite de uso. Intenta en unos minutos.',
};
```

💡 **¿Por qué constantes de mensajes?** Dos razones:

1. **Consistencia**: El mismo error siempre muestra el mismo mensaje.
2. **i18n-ready**: Si algún día necesitas traducir la app al inglés, solo cambias este archivo.

---

## 📁 `tests/` — Tests del Proyecto

| Carpeta              | ¿Para qué?                                 |
| -------------------- | ------------------------------------------ |
| `tests/api/`         | Tests de los endpoints API                 |
| `tests/config/`      | Tests de la configuración (env, features)  |
| `tests/mocks/`       | Handlers de MSW para simular APIs externas |
| `tests/performance/` | Tests de rendimiento                       |
| `tests/setup.msw.ts` | Setup global de MSW para todos los tests   |

🧠 **Concepto**: **MSW (Mock Service Worker)** intercepta llamadas HTTP en los tests y retorna respuestas predefinidas. Así no necesitas un servidor real para testear.

---

## 📁 `public/` — Archivos Estáticos

| Archivo         | ¿Para qué?                                  |
| --------------- | ------------------------------------------- |
| `manifest.json` | Configuración PWA (nombre, iconos, colores) |
| `icon-192.png`  | Ícono de la app 192x192 para PWA            |
| `icon-512.png`  | Ícono de la app 512x512 para PWA            |
| `*.svg`         | Íconos SVG varios                           |

🧠 **Concepto**: **PWA (Progressive Web App)** permite que la app se instale en el teléfono como si fuera una app nativa. El `manifest.json` define cómo se ve cuando se instala.

---

## 📁 `docs/` — Documentación del Proyecto

| Archivo                       | ¿Para qué?                                  |
| ----------------------------- | ------------------------------------------- |
| `AI_TOOLS_GUIDE.md`           | Guía detallada de las herramientas de IA    |
| `API.md`                      | Documentación de endpoints y server actions |
| `CONTRIBUTING.md`             | Guía para contribuir al proyecto            |
| `RULES.md`                    | Reglas y convenciones del código            |
| `ARCHITECTURE-ROADMAP-V04.md` | Roadmap de arquitectura del proyecto        |
| `Test.md`                     | Documentación del sistema de testing        |
| `backend/`                    | Documentación del backend GIMA (Laravel)    |
| `studies/`                    | Estudios y análisis del sistema             |

---

## 🎓 Resumen Final

Si llegaste hasta aquí, ¡felicidades! Ya conoces todo el proyecto. Aquí un resumen visual de cómo todo se conecta:

```
                        ┌──────────────┐
                        │   Usuario    │
                        └──────┬───────┘
                               │
                     Texto / Voz / Imagen
                               │
                        ┌──────▼───────┐
                        │   page.tsx   │  Client Component
                        │   (Chat)     │
                        └──────┬───────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
        ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │ POST /api/  │ │  Server     │ │  /tools/*   │
        │   chat      │ │  Actions    │ │  (páginas)  │
        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
               │               │               │
        ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │ChatService  │ │Gemini API   │ │ AI Services │
        │  + GROQ     │ │(voz/imagen) │ │(BaseAIServ.)│
        └──────┬──────┘ └─────────────┘ └──────┬──────┘
               │                               │
        ┌──────▼──────────────────────────────▼──────┐
        │                                            │
        │        Validación (Zod Schemas)             │
        │        Configuración (config/*)              │
        │        Logging (logger.ts)                   │
        │                                            │
        └────────────────────────────────────────────┘
```

---

**← Anterior**: [16 — Herramientas IA](./16-feature-herramientas-ia.md) | **Inicio**: [00 — Índice](./00-indice.md)
