/**
 * Constantes para servicios de IA
 *
 * Centraliza configuración de modelos, límites, y parámetros
 * para todas las features que usan IA.
 */

/**
 * Modelos de IA disponibles por proveedor
 *
 * GROQ: Generación de texto (chat, parsing, transformaciones)
 * Gemini: Multimodal (voz, imagen, PDF)
 */
export const AI_MODELS = {
  GROQ: {
    LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  },
  GEMINI: {
    FLASH_LITE: 'gemini-2.5-flash-lite',
    FLASH: 'gemini-2.5-flash',
  },
} as const;

/**
 * Configuración de modelos por tarea
 *
 * Define qué modelo de IA se usa para cada funcionalidad del sistema.
 * Basado en la implementación actual en app/api/chat y app/actions.
 * @example
 * ```typescript
 * const config = AI_TASK_MODELS.CHECKLIST_GENERATION;
 * const model = config.model; // 'llama-3.3-70b-versatile'
 * ```
 */
export const AI_TASK_MODELS = {
  // ============================================
  // GROQ - Generación de Texto
  // ============================================

  /**
   * Chat conversacional principal
   *
   * Usado en: app/api/chat/route.ts
   * Modelo: llama-3.3-70b-versatile
   */
  CHAT: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: undefined,
  },

  /**
   * Generación de checklists de mantenimiento
   *
   * Usado en: Para implementar
   * Modelo: llama-3.3-70b-versatile
   */
  CHECKLIST_GENERATION: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.3,
    maxTokens: 2000,
  },

  /**
   * Resúmenes automáticos de actividades
   *
   * Usado en: Para implementar
   * Modelo: llama-3.3-70b-versatile
   */
  ACTIVITY_SUMMARY: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.4,
    maxTokens: 500,
  },

  /**
   * Transformaciones de datos con IA
   *
   * Usado en: Para implementar
   * Modelo: llama-3.3-70b-versatile
   */
  DATA_TRANSFORMATION: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.1,
    maxTokens: 1000,
  },

  /**
   * Notas de cierre de órdenes de trabajo
   *
   * Usado en: Para implementar
   * Modelo: llama-3.3-70b-versatile
   */
  WORK_ORDER_CLOSEOUT: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.3,
    maxTokens: 800,
  },

  // ============================================
  // Gemini - Multimodal (Voz, Imagen, PDF)
  // ============================================

  /**
   * Transcripción de audio a texto
   *
   * Usado en: app/actions/voice.ts línea 50
   * Modelo: gemini-2.5-flash-lite
   */
  VOICE_TRANSCRIPTION: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH_LITE,
    temperature: 0,
    maxTokens: 500,
  },

  /**
   * Parsing de comandos de voz a JSON estructurado
   *
   * Usado en: app/actions/voice.ts línea 148
   * Modelo: gemini-2.5-flash-lite
   */
  VOICE_COMMAND_PARSING: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH_LITE,
    temperature: 0,
    maxTokens: 300,
  },

  /**
   * Análisis de imágenes industriales
   *
   * Usado en: app/actions/vision.ts línea 50
   * Modelo: gemini-2.5-flash
   */
  IMAGE_ANALYSIS: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH,
    temperature: 0.2,
    maxTokens: 1000,
  },

  /**
   * Extracción de contenido de documentos PDF
   *
   * Usado en: app/actions/files.ts línea 47
   * Modelo: gemini-2.5-flash
   */
  PDF_EXTRACTION: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH,
    temperature: 0.1,
    maxTokens: 2000,
  },
} as const;

/**
 * Parámetros de cache por tipo de request
 */
export const AI_CACHE_TTL = {
  CHECKLIST: 3600, // 1 hora
  SUMMARY: 604800, // 7 días (no cambian)
  VOICE_COMMAND: 0, // No cachear (cada comando es único)
  TRANSFORMATION_PREVIEW: 300, // 5 minutos
  WORK_ORDER_CLOSEOUT: 0, // No cachear
} as const;

/**
 * Límites de rate limiting específicos para IA
 */
export const AI_RATE_LIMITS = {
  FREE_TIER: {
    requestsPerMinute: 10,
    requestsPerDay: 100,
  },
  PRO_TIER: {
    requestsPerMinute: 30,
    requestsPerDay: 1000,
  },
  ENTERPRISE_TIER: {
    requestsPerMinute: 100,
    requestsPerDay: 10000,
  },
} as const;

/**
 * Timeouts por tipo de operación
 */
export const AI_TIMEOUTS = {
  QUICK: 10000, // 10s  - Parsing de comandos
  NORMAL: 30000, // 30s - Generación de checklists
  LONG: 60000, // 60s  - Transformaciones de datos
} as const;

/**
 * Reintentos por tipo de error
 */
export const AI_RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 30000,
} as const;

/**
 * Tipos de activos para checklists de mantenimiento
 */
export const ASSET_TYPES = [
  'unidad-hvac',
  'caldera',
  'bomba',
  'compresor',
  'generador',
  'panel-electrico',
  'transportador',
  'grua',
  'montacargas',
  'otro',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * Tipos de tareas de mantenimiento
 */
export const TASK_TYPES = ['preventivo', 'correctivo', 'predictivo'] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Estilos para resúmenes de actividad
 */
export const SUMMARY_STYLES = {
  FORMAL: 'formal',
  CASUAL: 'casual',
  TECNICO: 'tecnico',
  EJECUTIVO: 'ejecutivo',
} as const;

export type SummaryStyle = (typeof SUMMARY_STYLES)[keyof typeof SUMMARY_STYLES];

/**
 * Niveles de detalle para resúmenes
 */
export const SUMMARY_DETAIL_LEVELS = {
  BREVE: 'breve', // 1-2 párrafos
  NORMAL: 'normal', // 3-4 párrafos
  DETALLADO: 'detallado', // 5+ párrafos con lista
} as const;

export type SummaryDetailLevel = (typeof SUMMARY_DETAIL_LEVELS)[keyof typeof SUMMARY_DETAIL_LEVELS];

/**
 * Palabras clave peligrosas para detección en comandos de voz
 */
export const DANGEROUS_VOICE_KEYWORDS = [
  'eliminar todo',
  'borrar todo',
  'cancelar todo',
  'delete all',
  'remove all',
  'cerrar todo',
] as const;

/**
 * Operaciones permitidas para transformaciones de datos
 */
export const ALLOWED_TRANSFORMATION_OPERATIONS = [
  'renombrar-campo',
  'convertir-tipo',
  'combinar-campos',
  'dividir-campo',
  'filtrar-registros',
  'ordenar-registros',
  'agregar-campo',
  'eliminar-campo',
  'calcular-campo',
] as const;

export type TransformationOperation = (typeof ALLOWED_TRANSFORMATION_OPERATIONS)[number];
