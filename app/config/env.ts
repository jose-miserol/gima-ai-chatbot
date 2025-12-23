// Validación y tipado de variables de entorno
import { z } from 'zod';

/**
 * envSchema - Esquema de validación Zod para variables de entorno
 *
 * Define las variables requeridas, sus formatos y valores por defecto.
 * Asegura que la aplicación falle rápido si falta configuración crítica.
 */
const envSchema = z.object({
  // API Keys (requeridas con validación de formato)
  GROQ_API_KEY: z
    .string()
    .min(1, 'GROQ_API_KEY es requerida')
    .startsWith('gsk_', 'GROQ API key debe empezar con "gsk_"'),
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .min(1, 'Google API Key es requerida')
    .startsWith('AIza', 'Google API key debe empezar con "AIza"'),
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * env - Objeto de configuración validado
 *
 * Contiene todas las variables de entorno procesadas y seguras para usar.
 * Lanza un error en tiempo de ejecución si la validación falla.
 */
export const env = envSchema.parse(process.env);

/**
 * Env - Tipo TypeScript inferido del esquema de entorno
 */
export type Env = z.infer<typeof envSchema>;
