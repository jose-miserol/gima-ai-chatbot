/**
 * Theme Feature Types
 *
 * Type definitions for the theme feature.
 */

import type { THEMES } from './constants';

/**
 * Theme type - either 'light' or 'dark'
 */
export type Theme = (typeof THEMES)[number];

/**
 * Theme configuration interface
 *
 * Represents the complete theme state including user preference
 * and system preference detection.
 */
export interface ThemeConfig {
  /**
   * Current active theme
   */
  theme: Theme;

  /**
   * Whether to use system color scheme preference
   */
  systemPreference: boolean;
}
