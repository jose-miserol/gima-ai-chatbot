// Configuración de modelos compartida entre cliente y servidor

export const AVAILABLE_MODELS = [
  {
    name: "Llama 3.3 70B",
    value: "llama-3.3-70b-versatile",
  },
] as const;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].value;

export type ModelValue = (typeof AVAILABLE_MODELS)[number]["value"];
