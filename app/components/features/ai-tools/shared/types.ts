/**
 * Tipos compartidos para AI Tools
 */

/**
 * Campo de formulario genérico
 */
export interface FormField {
  /**
   * Nombre del campo
   */
  name: string;

  /**
   * Label visible
   */
  label: string;

  /**
   * Tipo de input
   */
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';

  /**
   * Placeholder
   */
  placeholder?: string;

  /**
   * Opciones para select
   */
  options?: Array<{ value: string; label: string }>;

  /**
   * Requerido
   */
  required?: boolean;

  /**
   * Valor por defecto
   */
  defaultValue?: string | number | boolean;

  /**
   * Longitud máxima
   */
  maxLength?: number;

  /**
   * Valor mínimo (para number)
   */
  min?: number;

  /**
   * Valor máximo (para number)
   */
  max?: number;

  /**
   * Texto de ayuda
   */
  helpText?: string;

  /**
   * Filas para textarea
   */
  rows?: number;
}

/**
 * Estado de generación de IA
 */
export type AIGenerationStatus = 'idle' | 'generating' | 'success' | 'error' | 'cached';

/**
 * Metadata de generación
 */
export interface AIGenerationMetadata {
  /**
   * Timestamp de generación
   */
  generatedAt?: Date;

  /**
   * Modelo usado
   */
  model?: string;

  /**
   * Nivel de confianza
   */
  confidence?: number;

  /**
   * Conteo de palabras
   */
  wordCount?: number;

  /**
   * Duración de generación (ms)
   */
  duration?: number;

  /**
   * Si vino de caché
   */
  cached?: boolean;

  /**
   * Metadata adicional
   */
  [key: string]: unknown;
}

/**
 * Acciones de preview
 */
export interface AIPreviewActions {
  /**
   * Aceptar y guardar
   */
  onAccept: () => void;

  /**
   * Rechazar y descartar
   */
  onReject: () => void;

  /**
   * Regenerar con mismos parámetros
   */
  onRegenerate?: () => void;

  /**
   * Editar manualmente
   */
  onEdit?: () => void;
}
