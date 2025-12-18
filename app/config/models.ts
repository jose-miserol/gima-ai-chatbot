// Configuración de modelos compartida entre cliente y servidor

export const AVAILABLE_MODELS = [
  {
    name: "Llama 3.3 70B",
    value: "llama-3.3-70b-versatile",
  },
  {
    name: "Llama 3.1 8B",
    value: "llama-3.1-8b-instant",
  },
  {
    name: "Mixtral 8x7B",
    value: "mixtral-8x7b-32768",
  },
] as const;

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].value;

export type ModelValue = (typeof AVAILABLE_MODELS)[number]["value"];
