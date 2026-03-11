/**
 * @file models.ts
 * @module app/config/models
 *
 * ============================================================
 * CONFIGURACIÓN DE MODELOS DE IA — CATÁLOGO PÚBLICO (CLIENTE + SERVIDOR)
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define el catálogo de modelos de IA que el usuario puede seleccionar
 *   en la interfaz de chat de GIMA. Incluye el nombre visual (para mostrar
 *   en la UI) y el identificador de API (enviado al endpoint de GROQ).
 *
 * CONTEXTO EN GIMA:
 *   La UI de chat tiene un selector de modelo donde el técnico o ingeniero
 *   puede elegir con qué modelo de lenguaje desea interactuar. Este archivo
 *   es la fuente de verdad de qué opciones aparecen en ese selector.
 *
 * DIFERENCIA CON ai.ts:
 *   - `models.ts` (este archivo): catálogo público para el SELECTOR DE UI.
 *     Solo contiene modelos que el usuario puede elegir manualmente.
 *     Compartido entre cliente y servidor.
 *
 *   - `ai.ts`: configuración técnica interna para CADA FEATURE de IA.
 *     Define qué modelo usa cada tarea (transcripción, checklist, etc.)
 *     con parámetros como temperatura y maxTokens. No se expone al usuario.
 *
 * POR QUÉ `as const`:
 *   Convierte el array a un tipo de solo lectura con valores literales.
 *   Sin `as const`, TypeScript inferiría `value: string`, lo que permitiría
 *   pasar cualquier string como modelo. Con `as const`, el tipo es
 *   `value: 'llama-3.1-8b-instant'` (literal), habilitando validación estática.
 *
 * DÓNDE SE IMPORTA:
 *   - Componente ModelSelector en la UI del chat
 *   - ChatService para validar que el modelo solicitado sea permitido
 *   - Re-exportado desde app/config/index.ts
 * ============================================================
 */

/**
 * AVAILABLE_MODELS — Lista de modelos disponibles para el selector de la UI.
 *
 * QUÉ ES:
 *   Array de configuraciones de modelo. Cada entrada tiene:
 *   - `name`: nombre legible para mostrar en el dropdown de la UI.
 *   - `value`: identificador exacto de la API de GROQ (se envía en la request).
 *
 * CÓMO AGREGAR UN NUEVO MODELO:
 *   1. Añadir una nueva entrada al array con el name y value correctos.
 *   2. Verificar que el modelo esté disponible en la cuenta de GROQ.
 *   3. El tipo `ModelValue` se actualizará automáticamente por inferencia.
 *
 * NOTA SOBRE EL MODELO ACTUAL:
 *   Llama 3.1 8B Instant es el modelo de menor latencia en GROQ, ideal para
 *   el chat en tiempo real donde la velocidad de respuesta importa más que
 *   la capacidad del modelo (los técnicos necesitan respuestas rápidas).
 *   Para tareas más complejas se usa Llama 3.3 70B definido en ai.ts.
 */
export const AVAILABLE_MODELS = [
  {
    name: 'Llama 3.1 8B', // Nombre mostrado en el selector de UI
    value: 'llama-3.1-8b-instant', // Identificador exacto en la API de GROQ
  },
] as const; // `as const` habilita inferencia de tipos literales para ModelValue

/**
 * DEFAULT_MODEL — Modelo seleccionado por defecto al abrir el chat.
 *
 * QUÉ ES: El `value` del primer modelo de la lista.
 * POR QUÉ ES EL PRIMERO: Convención del proyecto — el modelo recomendado
 * siempre es el primero del array. Si se quiere cambiar el default,
 * basta con reordenar AVAILABLE_MODELS.
 */
export const DEFAULT_MODEL = AVAILABLE_MODELS[0].value;

/**
 * ModelValue — Tipo union de los valores de modelo disponibles.
 *
 * QUÉ ES: Tipo TypeScript inferido automáticamente de AVAILABLE_MODELS.
 *         Actualmente: `'llama-3.1-8b-instant'`
 *
 * PARA QUÉ SE USA:
 *   - Para tipar el parámetro `model` en funciones que aceptan un modelo seleccionado.
 *   - Para que TypeScript rechace en compilación cualquier string que no sea
 *     un modelo válido de la lista.
 *
 */
export type ModelValue = (typeof AVAILABLE_MODELS)[number]['value'];
