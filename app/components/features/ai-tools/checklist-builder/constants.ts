/**
 * Constantes para Smart Checklist Builder
 *
 * Define valores por defecto, configuración y constantes
 * usadas en la feature de generación de checklists.
 */

/**
 * Categorías de items de checklist
 */
export const CHECKLIST_CATEGORIES = [
  'seguridad',
  'operacion',
  'inspeccion-visual',
  'mediciones',
  'limpieza',
  'lubricacion',
  'ajustes',
  'documentacion',
] as const;

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/**
 * Límites de generación
 */
export const CHECKLIST_LIMITS = {
  /**
   * Número mínimo de items en un checklist
   */
  MIN_ITEMS: 3,

  /**
   * Número máximo de items en un checklist
   */
  MAX_ITEMS: 50,

  /**
   * Longitud máxima de descripción de item
   */
  MAX_ITEM_DESCRIPTION_LENGTH: 200,

  /**
   * Longitud máxima de título de checklist
   */
  MAX_TITLE_LENGTH: 100,

  /**
   * Número máximo de templates guardados
   */
  MAX_SAVED_TEMPLATES: 20,
} as const;

/**
 * Mensajes de UI
 */
export const CHECKLIST_MESSAGES = {
  GENERATING: 'Generando checklist con IA...',
  GENERATION_SUCCESS: 'Checklist generado exitosamente',
  GENERATION_ERROR: 'Error al generar checklist',
  SAVE_SUCCESS: 'Template guardado',
  SAVE_ERROR: 'Error al guardar template',
  DELETE_CONFIRM: '¿Eliminar este template?',
  EMPTY_STATE: 'No hay checklists generados aún',
  NO_TEMPLATES: 'No hay templates guardados',
} as const;

/**
 * Claves de localStorage
 */
export const STORAGE_KEYS = {
  TEMPLATES: 'checklist-templates',
  RECENT_CHECKLISTS: 'recent-checklists',
  PREFERENCES: 'checklist-preferences',
} as const;

/**
 * Configuración por defecto
 */
export const DEFAULT_CHECKLIST_CONFIG = {
  /**
   * Número de items por defecto a generar
   */
  defaultItemCount: 10,

  /**
   * Si mostrar categorías por defecto
   */
  showCategories: true,

  /**
   * Si auto-guardar checklists generados
   */
  autoSave: false,
} as const;
