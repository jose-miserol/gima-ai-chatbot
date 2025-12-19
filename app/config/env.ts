// Validación y tipado de variables de entorno
import { z } from 'zod';

const envSchema = z.object({
  // API Keys (requeridas)
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY es requerida'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, 'Google API Key es requerida'),  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Validar al importar este módulo
export const env = envSchema.parse(process.env);

// Re-exportar el tipo para uso en toda la app
export type Env = z.infer<typeof envSchema>;
