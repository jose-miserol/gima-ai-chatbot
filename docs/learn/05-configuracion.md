# 05 — Configuración del Sistema

> La carpeta `config/` centraliza TODA la configuración de la app en un solo lugar. Si necesitas cambiar un prompt, un límite de tamaño, o un modelo de IA, vienes aquí.

---

## ¿Por qué centralizar la configuración?

💡 Imagina que el límite de audio está hardcodeado en 5 archivos distintos. Si necesitas cambiarlo a 10MB, debes encontrar y editar 5 archivos. Con configuración centralizada, cambias UN solo lugar y todo se actualiza.

---

## 📄 `config/env.ts` — Variables de Entorno Validadas

Es el validador principal que garantiza que todas las variables de entorno existan y tengan el formato estrictamente correcto en el servidor. Sirve para analizar y transformar los valores crudos del `.env` (como convertir strings a booleanos) antes de que la aplicación arranque. Existe para prevenir que la app falle de formas sorpresivas y confusas si alguien olvida configurar credenciales vitales como la `GROQ_API_KEY`; con este archivo, la omisión causa una falla inmediata y clara en el arranque con un reporte exacto del problema.

### Líneas Clave

```typescript
const envSchema = z.object({
  GROQ_API_KEY: z.string().optional().default('')
    .refine((val) => !val || val.startsWith('gsk_'), {
      message: 'GROQ API key debe empezar con "gsk_"',
    }),
```

🧠 **Concepto**: `.refine()` es una validación personalizada de Zod. Dice: "Si la key existe, debe empezar con `gsk_`". Esto detecta errores como pegar una API key de Google en el campo de GROQ.

```typescript
  NEXT_PUBLIC_DEMO_MODE: z.string().default('false')
    .transform((val) => val === 'true'),  // String → Boolean
```

💡 **¿Por qué `.transform()`?** Las variables de entorno son siempre strings. `.transform()` convierte `"true"` en `true` (boolean) para usarlo fácilmente en el código.

```typescript
export const env = envSchema.parse(process.env); // ← Falla AQUÍ si hay error
```

⚠️ **Cuidado**: Si algo está mal, la app no arranca. Verás un `ZodError` con el detalle exacto de qué variable falta o es inválida.

---

## 📄 `config/features.ts` — Feature Flags

Representa el sistema de control de despliegue ("Feature Flags" o banderas de características) para activar o desactivar funcionalidades progresiva y gradualmente. Sirve operativamente para habilitar ciertas capacidades experimentales (como el chat por voz o el análisis de PDF) solo a grupos específicos o porcentajes controlados de la base de usuarios. Existe porque lanzar nuevas características masivamente a todos los técnicos al mismo tiempo es riesgoso; esto permite probar una función nueva con el 25% de los usuarios, medir el impacto, y solo después implementarla de manera general.

### Configuración de Flags

```typescript
export const FEATURE_FLAGS = {
  voiceCommands: {
    enabled: env.NEXT_PUBLIC_FEATURE_VOICE_COMMANDS, // true/false desde .env
    rollout: {
      percentage: 25, // 25% de usuarios ven esta feature
      allowlist: [
        // Estos emails SIEMPRE ven la feature
        // 'admin@uneg.edu.ve',
      ],
    },
  },
  pdfReader: {
    enabled: env.NEXT_PUBLIC_FEATURE_PDF_READER,
    rollout: {
      percentage: 0, // Solo la allowlist (testing interno)
      allowlist: [],
    },
  },
};
```

### ¿Cómo Decide si Mostrar la Feature?

```typescript
export function isFeatureEnabled(feature: FeatureName, userId?: string): boolean {
  // 1. Feature deshabilitada globalmente → NO
  if (!config.enabled) return false;

  // 2. Usuario en allowlist → SÍ (siempre)
  if (userId && config.rollout.allowlist.includes(userId)) return true;

  // 3. Rollout 100% → SÍ para todos
  if (config.rollout.percentage === 100) return true;

  // 4. Rollout 0% → NO (solo allowlist)
  if (config.rollout.percentage === 0) return false;

  // 5. Rollout por porcentaje → Decidir con hash del email
  const hash = simpleHash(userId);
  return hash % 100 < config.rollout.percentage;
}
```

💡 **¿Por qué hash y no random?** Si usamos `Math.random()`, un usuario vería la feature a veces sí y a veces no. Con hash del email, la decisión es **consistente**: siempre la misma respuesta para el mismo usuario.

---

## 📄 `config/limits.ts` — Límites de Tamaño

Es el repositorio unificado de las constantes críticas que definen los límites máximos permitidos en toda la aplicación (como el peso máximo de un PDF o la extensión límite de un texto). Sirve como fuente de verdad para que validadores tanto en el lado del cliente (UI) como en el servidor (API) comprueben los mismos umbrales de peso y prevengan abusos en la red. Existe estrictamente como un archivo independiente porque múltiples contextos inconexos (Server Actions, custom hooks, componentes de interfaz) necesitan acceder a estos valores absolutos; al centralizarlos aquí, cambiar un límite de "5MB" a "10MB" actualiza simultáneamente toda la aplicación sin crear inconsistencias.

```typescript
// Audio
export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_AUDIO_SIZE_MB = 5;

// Imágenes
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// PDFs
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Mensajes de texto
export const MAX_MESSAGE_TEXT_BYTES = 10 * 1024; // 10KB (~5000 palabras)

// Historial
export const MAX_STORED_MESSAGES = 100; // 100 mensajes en localStorage
```

### Funciones Helper

```typescript
export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10; // Redondea a 1 decimal
}

export function exceedsLimit(sizeInBytes: number, limitInBytes: number): boolean {
  return sizeInBytes > limitInBytes;
}
```

💡 **¿Por qué helpers?** En vez de repetir `bytes / (1024 * 1024)` en 10 archivos, lo haces una vez y lo importas.

---

## 📄 `config/models.ts` — Modelos de IA

Contiene el catálogo inmutable del sistema referente a los modelos de inteligencia artificial autorizados y disponibles para su uso en el chatbot. Sirve para proveer constantes literales robustas e IDs precisos (como el de `Llama 3.3 70B` en GROQ) al orquestador del chat y a la interfaz de selección visual. Su existencia garantiza que la aplicación no sufra errores de tipeo al momento de enrutar peticiones a los LLMs, asegurando que un modelo defectuoso o descontinuado pueda reemplazarse fácilmente desde un único punto unificado.

```typescript
export const AVAILABLE_MODELS = [
  {
    name: 'Llama 3.3 70B', // Nombre visible al usuario
    value: 'llama-3.3-70b-versatile', // ID para la API de GROQ
  },
] as const;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].value;
```

💡 **¿Por qué `as const`?** Hace que TypeScript trate los valores como literales. En vez de `type: string`, el tipo es exactamente `'llama-3.3-70b-versatile'`. Esto previene typos.

---

## 📄 `config/server.ts` — Prompts del Sistema

Constituye el núcleo de comportamiento lingüístico, ya que contiene los "prompts del sistema" secretos que se inyectan silenciosamente detrás de escena a los modelos de inteligencia artificial en cada consulta. Sirve funcionalmente para fijar la "personalidad" técnica del asistente conversacional, instruyéndole reglas estrictas, formatos de respuestas esperados (como JSON forzado) y un glosario de términos industriales inalterable. Existe porque un modelo en blanco es demasiado genérico y peligroso; al forzarle este contexto constante, nos aseguramos de que siempre responda alineado con la seguridad, el formato y el vocabulario técnico específico del departamento de mantenimiento de la UNEG.

### Glosario de Acrónimos

```typescript
const ACRONYMS_GLOSSARY: Record<string, string> = {
  UMA: 'Unidad Manejadora de Aire',
  BCA: 'Bomba Centrífuga de Agua',
  TAB: 'Tablero de Distribución Eléctrica',
  ST: 'Subestación Transformadora',
  GIMA: 'Gestión Integral de Mantenimiento y Activos',
  OT: 'Orden de Trabajo',
  MP: 'Mantenimiento Preventivo',
  MC: 'Mantenimiento Correctivo',
};
```

💡 **¿Por qué un glosario?** Cuando un técnico dice "La UMA del sector 3 falla", la IA necesita saber que UMA = Unidad Manejadora de Aire. El glosario se inyecta en todos los prompts.

### SYSTEM_PROMPT — La Personalidad del Asistente

```typescript
export const SYSTEM_PROMPT = `
Eres un asistente experto en gestión de mantenimiento y activos para la UNEG.

Tu objetivo es ayudar a técnicos, ingenieros y personal de mantenimiento con:
- Consultas sobre equipos y su estado
- Procedimientos de mantenimiento preventivo y correctivo
- Diagnóstico de fallas comunes
- Recomendaciones de repuestos

Directrices:
1. Sé preciso y técnico, pero claro
2. Si un usuario usa una sigla del glosario (ej: "UMA"), entiende a qué se refiere
3. Si no estás seguro, admítelo y sugiere consultar un manual
4. Prioriza la seguridad en todas las recomendaciones
`;
```

### VOICE_PROMPT — Transcripción Literal

```typescript
export const VOICE_PROMPT = `
Actúa como una máquina de transcripción estricta.
Tu ÚNICA función es convertir el audio en texto, palabra por palabra.

REGLAS DE ORO:
1. Escribe EXACTAMENTE lo que escuchas.
2. NO inventes, NO completes frases.
3. NO incluyas marcas de tiempo.
`;
```

💡 **¿Por qué tan estricto?** Sin estas reglas, la IA podría "mejorar" la transcripción, cambiando palabras o completando frases. Queremos el texto exacto.

### INVENTORY_PROMPT — Análisis de Piezas

```typescript
export const INVENTORY_PROMPT = `
Eres un Auditor de Inventario Experto para el sistema GIMA.

FORMATO DE SALIDA:
\`\`\`json
{
  "item_name": "Nombre Técnico",
  "category": "Categoría",
  "quantity_detected": 1,
  "condition": "Nuevo/Usado/Dañado",
  "brand": "Marca",
  "serial_number": "S/N"
}
\`\`\`
`;
```

💡 **¿Por qué JSON en el prompt?** Le mostramos a la IA el formato exacto que queremos. Así el frontend puede parsear la respuesta y mostrarla en tarjetas estructuradas.

---

## 📄 `config/prompts/` — Prompts de Herramientas

Cada herramienta de IA tiene su prompt especializado:

| Archivo                          | Herramienta         | Qué hace el prompt                                         |
| -------------------------------- | ------------------- | ---------------------------------------------------------- |
| `checklist-generation.ts`        | Checklist Builder   | Le dice a la IA cómo generar un checklist de mantenimiento |
| `activity-summary-generation.ts` | Activity Summary    | Instrucciones para resúmenes profesionales                 |
| `closeout-generation.ts`         | Work Order Closeout | Formato de notas de cierre de OTs                          |

---

## 📄 `config/index.ts` — Re-exportación

```typescript
export * from './models';
export * from './server';
```

💡 **¿Para qué?** Permite importar como `import { SYSTEM_PROMPT, DEFAULT_MODEL } from '@/app/config'` en lugar de dos imports separados.

---

## 🔗 Quién Usa Cada Configuración

```
config/env.ts ──────→ api/chat/route.ts, services/*
config/limits.ts ───→ actions/voice.ts, hooks/use-file-upload.ts
config/models.ts ───→ ChatService, model-selector.tsx
config/server.ts ───→ api/chat/route.ts, actions/voice.ts, actions/vision.ts
config/features.ts ─→ feature-guard.tsx, componentes condionales
```

---

**← Anterior**: [04 — Server Actions](./04-server-actions.md) | **Siguiente**: [06 — Custom Hooks](./06-hooks.md) →
