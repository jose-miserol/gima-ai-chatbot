/**
 * Configuración de Modelos de IA
 *
 * Define los modelos disponibles para su uso en la aplicación.
 * Compartido entre cliente y servidor.
 */

/**
 * AVAILABLE_MODELS - Lista de modelos soportados
 *
 * Contiene la configuración de nombre visual y valor de API para cada modelo.
 */
export const AVAILABLE_MODELS = [
  {
    name: 'Llama 3.1 8B',
    value: 'llama-3.1-8b-instant',
  },
] as const;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].value;

export type ModelValue = (typeof AVAILABLE_MODELS)[number]['value'];
