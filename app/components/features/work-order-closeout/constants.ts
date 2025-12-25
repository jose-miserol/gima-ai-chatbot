/**
 * Constantes para Work Order Closeout
 *
 * Define valores por defecto y configuración para
 * la generación de notas de cierre.
 */

/**
 * Estilos de notas disponibles
 */
export const CLOSEOUT_STYLES = ['formal', 'technical', 'brief'] as const;

/**
 * Límites de generación
 */
export const CLOSEOUT_LIMITS = {
  /**
   * Longitud mínima de descripción de trabajo (caracteres)
   */
  MIN_WORK_DESCRIPTION: 20,

  /**
   * Longitud máxima de notas completas (caracteres)
   */
  MAX_NOTES_LENGTH: 3000,

  /**
   * Número máximo de historiales guardados
   */
  MAX_SAVED_HISTORY: 15,

  /**
   * Tiempo mínimo de trabajo en horas
   */
  MIN_TIME_SPENT: 0.25,
} as const;

/**
 * Mensajes de UI
 */
export const CLOSEOUT_MESSAGES = {
  GENERATING: 'Generando notas de cierre con IA...',
  GENERATION_SUCCESS: 'Notas generadas exitosamente',
  GENERATION_ERROR: 'Error al generar notas',
  SAVE_SUCCESS: 'Notas guardadas en historial',
  SAVE_ERROR: 'Error al guardar notas',
  DELETE_CONFIRM: '¿Eliminar estas notas del historial?',
  EMPTY_STATE: 'No hay notas de cierre generadas aún',
  NO_HISTORY: 'No hay notas guardadas en historial',
  INCOMPLETE_DATA: 'Datos del work order incompletos',
  WORK_TOO_SHORT: 'La descripción del trabajo es muy corta (mínimo 20 caracteres)',
} as const;

/**
 * Claves de localStorage
 */
export const STORAGE_KEYS = {
  HISTORY: 'closeout-history',
  PREFERENCES: 'closeout-preferences',
  RECENT_NOTES: 'recent-closeout-notes',
} as const;

/**
 * Configuración por defecto
 */
export const DEFAULT_CLOSEOUT_CONFIG = {
  /**
   * Estilo por defecto
   */
  defaultStyle: 'formal' as const,

  /**
   * Incluir recomendaciones por defecto
   */
  includeRecommendations: true,

  /**
   * Auto-guardar en historial
   */
  autoSave: false,
} as const;

/**
 * Descripciones de estilos para UI
 */
export const STYLE_DESCRIPTIONS = {
  formal: 'Lenguaje profesional y estructurado con párrafos completos',
  technical: 'Terminología técnica precisa con detalles de procedimientos',
  brief: 'Formato conciso tipo bullet points, solo lo esencial',
} as const;
