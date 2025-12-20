// Validación y tipado de variables de entorno
import { z } from 'zod';

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

// Validar al importar este módulo
export const env = envSchema.parse(process.env);

// Re-exportar el tipo para uso en toda la app
export type Env = z.infer<typeof envSchema>;
