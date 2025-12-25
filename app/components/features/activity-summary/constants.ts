/**
 * Constantes para Activity Summaries
 *
 * Define valores por defecto y configuración para
 * la generación de resúmenes de actividades.
 */

/**
 * Estilos de resumen disponibles
 */
export const SUMMARY_STYLES = ['ejecutivo', 'tecnico', 'narrativo'] as const;

/**
 * Niveles de detalle
 */
export const DETAIL_LEVELS = ['alto', 'medio', 'bajo'] as const;

/**
 * Límites de generación
 */
export const SUMMARY_LIMITS = {
  /**
   * Longitud mínima de actividades (caracteres)
   */
  MIN_ACTIVITIES_LENGTH: 50,

  /**
   * Longitud máxima de actividades (caracteres)
   */
  MAX_ACTIVITIES_LENGTH: 5000,

  /**
   * Longitud máxima de contexto
   */
  MAX_CONTEXT_LENGTH: 500,

  /**
   * Número máximo de templates guardados
   */
  MAX_SAVED_TEMPLATES: 20,
} as const;

/**
 * Mensajes de UI
 */
export const SUMMARY_MESSAGES = {
  GENERATING: 'Generando resumen con IA...',
  GENERATION_SUCCESS: 'Resumen generado exitosamente',
  GENERATION_ERROR: 'Error al generar resumen',
  SAVE_SUCCESS: 'Resumen guardado',
  SAVE_ERROR: 'Error al guardar resumen',
  DELETE_CONFIRM: '¿Eliminar este resumen?',
  EMPTY_STATE: 'No hay resúmenes generados aún',
  NO_TEMPLATES: 'No hay templates guardados',
  ACTIVITIES_TOO_SHORT: 'Las actividades son muy cortas (mínimo 50 caracteres)',
  ACTIVITIES_TOO_LONG: 'Las actividades son muy largas (máximo 5000 caracteres)',
} as const;

/**
 * Claves de localStorage
 */
export const STORAGE_KEYS = {
  TEMPLATES: 'summary-templates',
  RECENT_SUMMARIES: 'recent-summaries',
  PREFERENCES: 'summary-preferences',
} as const;

/**
 * Configuración por defecto
 */
export const DEFAULT_SUMMARY_CONFIG = {
  /**
   * Estilo por defecto
   */
  defaultStyle: 'tecnico' as const,

  /**
   * Nivel de detalle por defecto
   */
  defaultDetailLevel: 'medio' as const,

  /**
   * Si auto-guardar resúmenes generados
   */
  autoSave: false,
} as const;
