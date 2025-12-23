/**
 * Theme Feature Constants
 *
 * Centralized configuration for the theme feature.
 * Contains theme options, storage keys, and default values.
 */

/**
 * Available theme options
 */
export const THEMES = ['light', 'dark'] as const;

/**
 * Theme configuration constants
 */
export const THEME_CONFIG = {
  /**
   * LocalStorage key for persisting theme preference
   */
  storageKey: 'theme',

  /**
   * Default theme when no preference is set
   */
  defaultTheme: 'light',

  /**
   * Transition duration for theme changes (in milliseconds)
   */
  transitionDuration: 200,

  /**
   * CSS class name applied to html element for dark mode
   */
  darkModeClass: 'dark',
} as const;
