/**
 * @file env.ts
 * @module app/config/env
 *
 * ============================================================
 * VALIDACIÓN Y TIPADO DE VARIABLES DE ENTORNO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Valida todas las variables de entorno al arrancar el servidor usando Zod.
 *   Si falta una variable crítica o tiene formato incorrecto, la aplicación
 *   falla inmediatamente con un mensaje de error claro antes de recibir
 *   cualquier request de usuario.
 *
 * POR QUÉ VALIDAR VARIABLES DE ENTORNO:
 *   Sin este módulo, los errores de configuración aparecerían en producción
 *   como errores crípticos en el momento de uso (ej: "Cannot read property
 *   of undefined" o "API key invalid" al hacer la primera llamada a GROQ).
 *   Con este módulo, el error aparece en el deploy con un mensaje descriptivo:
 *   "GROQ API key debe empezar con 'gsk_'".
 *
 * PATRÓN FAIL-FAST:
 *   `envSchema.parse(process.env)` lanza una excepción si la validación falla.
 *   En Next.js, esto detiene el servidor al iniciar, forzando a corregir
 *   la configuración antes de que llegue a producción.
 *
 * VARIABLES PÚBLICAS vs PRIVADAS:
 *   - Sin prefijo NEXT_PUBLIC_: Solo accesibles en el servidor.
 *     Ejemplos: GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, BACKEND_API_KEY.
 *     NUNCA llegan al bundle del navegador.
 *
 *   - Con NEXT_PUBLIC_: Accesibles tanto en servidor como en cliente (navegador).
 *     Ejemplos: NEXT_PUBLIC_BACKEND_API_URL, NEXT_PUBLIC_DEMO_MODE.
 *     Usar solo para valores que sea seguro exponer públicamente.
 *
 * DÓNDE SE IMPORTA:
 *   - app/api/chat/route.ts → env.NODE_ENV para configuración de IP
 *   - app/actions/auth.ts → env.NEXT_PUBLIC_BACKEND_API_URL para URL del backend
 *   - Re-exportado desde app/config/index.ts
 * ============================================================
 */

import { z } from 'zod';

// ============================================================
// SCHEMA DE VALIDACIÓN
// ============================================================

/**
 * envSchema — Schema Zod que define y valida todas las variables de entorno.
 *
 * DISEÑO DE VALIDACIONES:
 *
 *   API Keys (opcional con validación condicional):
 *     Se definen como `.optional().default('')` porque:
 *     - No toda instancia de GIMA necesita ambas keys (puede usarse solo GROQ o solo Gemini).
 *     - El `.refine()` aplica la validación de formato SOLO cuando la variable tiene valor,
 *       evitando falsos positivos cuando la variable simplemente no está configurada.
 *
 *   NODE_ENV (enum):
 *     Solo acepta los tres valores estándar de Node.js. Cualquier otro valor
 *     (ej: "prod", "dev") fallaría la validación y daría un error descriptivo.
 *
 *   URLs (z.string().url() o z.literal('')):
 *     El `.or(z.literal(''))` permite que la URL sea un string vacío cuando
 *     no está configurada. Sin esto, una variable vacía fallaría la validación
 *     de URL aunque sea "opcional" en la práctica.
 *
 *   Booleans como strings (.transform):
 *     Las variables de entorno siempre son strings en process.env.
 *     El `.transform((val) => val === 'true')` convierte "true"/"false"
 *     al tipo boolean de TypeScript. Esto permite usar `if (env.NEXT_PUBLIC_DEMO_MODE)`
 *     directamente en el código sin conversiones manuales.
 */
const envSchema = z.object({
  // ----------------------------------------------------------
  // API KEYS DE MODELOS DE IA
  // ----------------------------------------------------------

  /**
   * GROQ_API_KEY — Clave para el proveedor GROQ (modelos Llama).
   *
   * USADO EN: ChatService para el chat conversacional principal.
   * FORMATO: Debe empezar con "gsk_" (prefijo estándar de GROQ).
   * OBTENER EN: https://console.groq.com/keys
   * REQUERIDO: Para funcionalidad de chat. Sin esta key, el chat no funciona.
   */
  GROQ_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('gsk_'), {
      message: 'GROQ API key debe empezar con "gsk_" si se proporciona',
    }),

  /**
   * GOOGLE_GENERATIVE_AI_API_KEY — Clave para Google Gemini (multimodal).
   *
   * USADO EN: voice.ts (transcripción), vision.ts (imágenes), files.ts (PDFs).
   * FORMATO: Debe empezar con "AIza" (prefijo estándar de Google AI).
   * OBTENER EN: https://makersuite.google.com/app/apikey
   * REQUERIDO: Para features de voz, visión e imágenes. El chat básico funciona sin ella.
   */
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('AIza'), {
      message: 'Google API key debe empezar con "AIza" si se proporciona',
    }),

  // ----------------------------------------------------------
  // ENTORNO DE EJECUCIÓN
  // ----------------------------------------------------------

  /**
   * NODE_ENV — Entorno de ejecución de la aplicación.
   *
   * USADO EN:
   *   - auth.ts: desactiva validación SSL solo en 'development'.
   *   - route.ts: permite IPs localhost solo en 'development'.
   *   - Cualquier código que deba comportarse diferente en prod vs dev.
   * VALORES: 'development' | 'production' | 'test'
   * DEFAULT: 'development' (para que el servidor arranque sin configuración inicial).
   */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ----------------------------------------------------------
  // INTEGRACIÓN CON BACKEND LARAVEL
  // ----------------------------------------------------------

  /**
   * NEXT_PUBLIC_BACKEND_API_URL — URL base del backend Laravel de GIMA.
   *
   * USADO EN: auth.ts para construir la URL del endpoint de login.
   *           También en herramientas del chat para llamadas al backend.
   * PÚBLICO (NEXT_PUBLIC_): La URL del backend es segura de exponer al cliente
   *                          (no es un secreto, es una dirección de servidor).
   * EJEMPLO: 'https://gima-backend.test' (desarrollo) o 'https://api.gima.uneg.edu.ve' (prod)
   * OPCIONAL: Si no se configura, auth.ts usa 'https://gima-backend.test' como fallback.
   */
  NEXT_PUBLIC_BACKEND_API_URL: z.string().url().optional().or(z.literal('')),

  /**
   * BACKEND_API_KEY — Clave de autenticación para el backend GIMA.
   *
   * PRIVADA (sin NEXT_PUBLIC_): Es un secreto que nunca debe llegar al cliente.
   * USADO EN: Herramientas del chat que hacen llamadas autenticadas al backend.
   * NOTA: Diferente al token Sanctum del usuario — esta es la API key del sistema.
   */
  BACKEND_API_KEY: z.string().optional().or(z.literal('')),

  /**
   * NEXT_PUBLIC_DEMO_MODE — Activa el modo demo de la aplicación.
   *
   * QUÉ ES: Cuando es `true`, la aplicación usa datos de ejemplo en lugar
   *         de llamar al backend real. Útil para demos y screenshots.
   * TIPO: Se almacena como string "true"/"false" en .env pero se transforma
   *       automáticamente a boolean por el `.transform()`.
   * DEFAULT: false (modo real por defecto).
   */
  NEXT_PUBLIC_DEMO_MODE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'), // "true" → true, cualquier otro valor → false

  // ----------------------------------------------------------
  // FEATURE FLAGS
  // ----------------------------------------------------------

  /**
   * NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE — Activa persistencia local del chat.
   *
   * QUÉ ES: Cuando es `true`, los mensajes del chat se guardan en localStorage
   *         del navegador y persisten entre sesiones.
   * LÍMITE: Hasta MAX_STORED_MESSAGES (100) mensajes (definido en limits.ts).
   * DEFAULT: false (sin persistencia por privacidad en equipos compartidos).
   * NOTA: Los técnicos de la UNEG comparten estaciones de trabajo, por eso
   *       la persistencia está desactivada por defecto.
   */
  NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'), // Mismo patrón de transformación string → boolean
});

// ============================================================
// OBJETO ENV VALIDADO
// ============================================================

/**
 * env — Objeto con todas las variables de entorno validadas y tipadas.
 *
 * QUÉ ES:
 *   El resultado de parsear `process.env` con el schema Zod.
 *   Cada propiedad está completamente tipada según su definición en envSchema.
 *
 * CUÁNDO SE EJECUTA:
 *   Al importar este módulo por primera vez (al arrancar el servidor Next.js).
 *   Si la validación falla, lanza `ZodError` con todos los campos inválidos,
 *   deteniendo el servidor antes de procesar cualquier request.
 *
 * CÓMO SE USA:
 *   ```typescript
 *   import { env } from '@/app/config/env';
 *   // o desde el barrel:
 *   import { env } from '@/app/config';
 *
 *   const backendUrl = env.NEXT_PUBLIC_BACKEND_API_URL; // string | undefined
 *   const isDev = env.NODE_ENV === 'development';        // boolean
 *   const isPersist = env.NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE; // boolean (ya transformado)
 *   ```
 */
export const env = envSchema.parse(process.env);

// ============================================================
// TIPO TYPESCRIPT
// ============================================================

/**
 * Env — Tipo TypeScript inferido automáticamente del schema Zod.
 *
 * QUÉ ES:
 *   Tipo que representa la forma del objeto `env` validado.
 *   Útil para tipar funciones que reciben la configuración de entorno.
 */
export type Env = z.infer<typeof envSchema>;
