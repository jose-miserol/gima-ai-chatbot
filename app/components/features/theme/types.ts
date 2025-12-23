/**
 * Tipos de la Funcionalidad de Tema
 *
 * Definiciones de tipos para la funcionalidad de tema.
 */

import type { THEMES } from './constants';

/**
 * Tipo de tema - ya sea 'light' o 'dark'
 */
export type Theme = (typeof THEMES)[number];

/**
 * Interfaz de configuración de tema
 *
 * Representa el estado completo del tema incluyendo preferencia de usuario
 * y detección de preferencia del sistema.
 */
export interface ThemeConfig {
  /**
   * Tema activo actual
   */
  theme: Theme;

  /**
   * Si usar preferencia de esquema de color del sistema
   */
  systemPreference: boolean;
}
