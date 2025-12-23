/**
 * Constantes de la Funcionalidad de Tema
 *
 * Configuración centralizada para la funcionalidad de tema.
 * Contiene opciones de tema, claves de almacenamiento y valores por defecto.
 */

/**
 * Opciones de tema disponibles
 */
export const THEMES = ['light', 'dark'] as const;

/**
 * Constantes de configuración de tema
 */
export const THEME_CONFIG = {
  /**
   * Clave de LocalStorage para persistir preferencia de tema
   */
  storageKey: 'theme',

  /**
   * Tema por defecto cuando no hay preferencia establecida
   */
  defaultTheme: 'light',

  /**
   * Duración de transición para cambios de tema (en milisegundos)
   */
  transitionDuration: 200,

  /**
   * Nombre de clase CSS aplicada al elemento html para modo oscuro
   */
  darkModeClass: 'dark',
} as const;
