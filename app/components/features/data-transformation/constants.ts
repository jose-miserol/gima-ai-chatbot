/**
 * Operaciones permitidas para la transformación de datos.
 * Whitelist de seguridad para limitar el alcance de las instrucciones AI.
 */
export const ALLOWED_OPERATIONS = [
  'filter',
  'sort',
  'format',
  'clean',
  'extract',
  'translate',
  'aggregate',
  'deduplicate',
  'regex_replace',
  'json_formatting',
  'csv_parsing',
] as const;

/**
 * Tamaño máximo de entrada permitido (50KB para prototipo)
 */
export const MAX_INPUT_SIZE = 50 * 1024;

/**
 * Instrucción por defecto para el prompt de sistema
 */
export const DEFAULT_TRANSFORMATION_INSTRUCTION =
  'Limpia estos datos y devuélvelos en formato JSON estructurado.';
