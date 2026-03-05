/**
 * Estado del proceso de transformación
 */
export type TransformationStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'previewing'
  | 'completed'
  | 'error';

/**
 * Formatos de datos soportados para input/output
 */
export type DataFormat = 'json' | 'csv' | 'text' | 'auto';

/**
 * Solicitud de transformación enviada al servicio
 */
export interface TransformationRequest {
  /** Datos crudos de origen */
  sourceData: string;
  /** Instrucción en lenguaje natural */
  instruction: string;
  /** Contexto adicional opcional */
  context?: string;
  /** Formato explícito si se conoce */
  format?: DataFormat;
}

/**
 * Estadísticas de la operación de transformación
 */
export interface TransformationStats {
  /** Número de adiciones en el diff */
  additions: number;
  /** Número de eliminaciones en el diff */
  deletions: number;
  /** Tiempo total de procesamiento en ms */
  durationMs: number;
  /** Estimación de items procesados (filas, objetos) */
  itemsProcessed?: number;
}

/**
 * Resultado de la transformación devuelto por la IA
 */
export interface TransformationResult {
  /** Indica si la operación fue exitosa */
  success: boolean;
  /** Datos resultantes transformados (puede ser objeto, string, array) */
  data: unknown;
  /** Diff textual opcional para visualización */
  diff?: string;
  /** Estadísticas de rendimiento y cambios */
  stats: TransformationStats;
  /** Mensaje de error si success es false */
  error?: string;
  /** Momento de finalización */
  timestamp: number;
}

/**
 * Snapshot de datos para historial y rollback
 */
export interface DataSnapshot {
  /** ID único del snapshot */
  id: string;
  /** Momento de creación */
  timestamp: number;
  /** Datos originales guardados */
  originalData: string;
  /** Hash SHA-256 para integridad */
  hash: string;
  /** Nombre opcional descriptivo */
  name?: string;
}
