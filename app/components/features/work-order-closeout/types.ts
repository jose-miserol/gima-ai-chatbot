/**
 * Tipos para Work Order Closeout
 *
 * Define interfaces para notas de cierre de órdenes de trabajo
 * generadas con IA.
 */

/**
 * Estilos de notas de cierre disponibles
 */
export type CloseoutStyle = 'formal' | 'technical' | 'brief';

/**
 * Resumen de datos del Work Order para generación
 */
export interface WorkOrderSummary {
  /**
   * ID del work order
   */
  id: string;

  /**
   * Título del trabajo
   */
  title: string;

  /**
   * Descripción del trabajo
   */
  description: string;

  /**
   * Tipo de activo
   */
  assetType: string;

  /**
   * Tipo de tarea (preventivo/correctivo/predictivo)
   */
  taskType: string;

  /**
   * Prioridad
   */
  priority: string;

  /**
   * Actividades realizadas
   */
  activities: string[];

  /**
   * Materiales utilizados (opcional)
   */
  materialsUsed?: string[];

  /**
   * Tiempo invertido en horas
   */
  timeSpent: number;

  /**
   * Problemas encontrados (opcional)
   */
  issues?: string[];
}

/**
 * Request para generar notas de cierre
 */
export interface CloseoutNotesRequest {
  /**
   * ID del work order
   */
  workOrderId: string;

  /**
   * Datos resumidos del work order
   */
  workOrderData: WorkOrderSummary;

  /**
   * Estilo de las notas
   */
  style: CloseoutStyle;

  /**
   * Incluir recomendaciones
   */
  includeRecommendations: boolean;
}

/**
 * Notas de cierre generadas
 */
export interface CloseoutNotes {
  /**
   * ID único de las notas
   */
  id: string;

  /**
   * ID del work order asociado
   */
  workOrderId: string;

  /**
   * Resumen ejecutivo del trabajo
   */
  summary: string;

  /**
   * Descripción detallada del trabajo realizado
   */
  workPerformed: string;

  /**
   * Hallazgos durante el trabajo
   */
  findings: string;

  /**
   * Recomendaciones para futuros trabajos (opcional)
   */
  recommendations?: string;

  /**
   * Materiales utilizados
   */
  materialsUsed: string;

  /**
   * Desglose de tiempo invertido
   */
  timeBreakdown: string;

  /**
   * Próximas acciones recomendadas (opcional)
   */
  nextActions?: string;

  /**
   * Estilo usado
   */
  style: CloseoutStyle;

  /**
   * Fecha de creación
   */
  createdAt: Date;

  /**
   * Metadata adicional
   */
  metadata?: {
    wordCount?: number;
    generatedBy: 'ai' | 'manual';
    version?: string;
  };
}

/**
 * Historial de notas guardadas
 */
export interface CloseoutHistory {
  /**
   * ID del historial
   */
  id: string;

  /**
   * Nombre descriptivo
   */
  name: string;

  /**
   * Notas asociadas
   */
  notes: CloseoutNotes;

  /**
   * Número de veces utilizado
   */
  usageCount: number;

  /**
   * Fecha de última actualización
   */
  updatedAt: Date;
}

/**
 * Estado del hook de generación
 */
export interface CloseoutGenerationState {
  /**
   * Si está generando actualmente
   */
  isGenerating: boolean;

  /**
   * Notas generadas
   */
  notes: CloseoutNotes | null;

  /**
   * Error si la generación falló
   */
  error: Error | null;

  /**
   * Progreso de generación (0-100)
   */
  progress: number;
}
