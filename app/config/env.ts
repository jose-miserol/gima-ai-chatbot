// Validación y tipado de variables de entorno
import { z } from 'zod';

/**
 * envSchema - Esquema de validación Zod para variables de entorno
 *
 * Define las variables requeridas, sus formatos y valores por defecto.
 * Asegura que la aplicación falle rápido si falta configuración crítica.
 */
const envSchema = z.object({
  // API Keys (opcionales con validación condicional)
  GROQ_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('gsk_'), {
      message: 'GROQ API key debe empezar con "gsk_" si se proporciona',
    }),
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .default('')
    .refine((val) => !val || val.startsWith('AIza'), {
      message: 'Google API key debe empezar con "AIza" si se proporciona',
    }),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Backend Integration
  NEXT_PUBLIC_BACKEND_API_URL: z.string().url().optional().or(z.literal('')),
  BACKEND_API_KEY: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_DEMO_MODE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
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
