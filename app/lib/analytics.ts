/**
 * Tracking de Analíticas y Métricas de Negocio
 *
 * Sistema de tracking para métricas de negocio y uso de features
 * Integra con logger estructurado y puede extenderse con servicios externos
 * @example
 * ```typescript
 * import { trackVoiceCommandUsage, trackPDFAnalysis } from '@/app/lib/analytics';
 *
 * // Rastrear comando de voz
 * trackVoiceCommandUsage(command, true, startTime);
 *
 * // Rastrear análisis de PDF
 * trackPDFAnalysis(pageCount, textLength, analysisTime, true);
 * ```
 */

import { logger } from './logger';

/**
 * Métricas de uso de comandos de voz
 */
interface VoiceCommandMetrics {
  /** Acción del comando (create_work_order, check_status, etc.) */
  action: string;
  /** Nivel de confianza de la transcripción (0-1) */
  confidence: number;
  /** Si el comando se ejecutó exitosamente */
  success: boolean;
  /** Tiempo de procesamiento en milisegundos */
  processingTimeMs: number;
  /** Si se mencionó un equipo específico */
  equipmentMentioned: boolean;
  /** Si se especificó prioridad */
  prioritySpecified: boolean;
  /** Si se asignó a alguien */
  assigneeMentioned: boolean;
}

/**
 * Métricas de análisis de PDF
 */
interface PDFAnalysisMetrics {
  /** Número de páginas del PDF */
  pageCount: number;
  /** Longitud del texto extraído */
  textLength: number;
  /** Tiempo de análisis en milisegundos */
  analysisTimeMs: number;
  /** Si el análisis fue exitoso */
  success: boolean;
  /** Modo de análisis (summary, qa, extract) */
  mode?: 'summary' | 'qa' | 'extract';
  /** Si se hizo una pregunta específica */
  hasQuery?: boolean;
}

/**
 * Métricas generales de feature usage
 */
interface FeatureUsageMetrics {
  /** Nombre de la feature */
  feature: string;
  /** Acción realizada */
  action: string;
  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

/**
 * Trackea el uso de comandos de voz
 *
 * Registra métricas de negocio para analizar:
 * - Tasa de éxito de comandos
 * - Tipos de comandos más usados
 * - Calidad de transcripción
 * - Tiempos de procesamiento
 * @param command - Comando de voz parseado
 * @param command.action
 * @param command.confidence
 * @param command.equipment
 * @param command.priority
 * @param command.assignee
 * @param success - Si el comando se ejecutó correctamente
 * @param startTime - Timestamp de inicio (Date.now())
 * @example
 * ```typescript
 * const startTime = Date.now();
 * const result = await parseVoiceCommand(transcript);
 * trackVoiceCommandUsage(result.command, result.success, startTime);
 * ```
 */
export function trackVoiceCommandUsage(
  command: {
    action: string;
    confidence: number;
    equipment?: string;
    priority?: string;
    assignee?: string;
  },
  success: boolean,
  startTime: number
): void {
  const metrics: VoiceCommandMetrics = {
    action: command.action,
    confidence: command.confidence,
    success,
    processingTimeMs: Date.now() - startTime,
    equipmentMentioned: !!command.equipment,
    prioritySpecified: !!command.priority,
    assigneeMentioned: !!command.assignee,
  };

  // Log estructurado para análisis
  logger.info('Voice command usage', {
    event: 'voice_command',
    ...metrics,
  });

  // Si está en browser, enviar a analytics externo (opcional)
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('Voice Command Used', {
      action: command.action,
      success,
      confidence: command.confidence,
      processingTime: metrics.processingTimeMs,
    });
  }
}

/**
 * Trackea el análisis de PDFs
 *
 * Registra métricas para analizar:
 * - Tamaño típico de PDFs analizados
 * - Tiempos de procesamiento
 * - Tasa de éxito
 * - Modos de análisis más usados
 * @param pageCount - Número de páginas del PDF
 * @param textLength - Caracteres de texto extraído
 * @param analysisTimeMs - Tiempo de análisis en ms
 * @param success - Si el análisis fue exitoso
 * @param options - Opciones de análisis usadas
 * @param options.mode
 * @param options.query
 */
export function trackPDFAnalysis(
  pageCount: number,
  textLength: number,
  analysisTimeMs: number,
  success: boolean,
  options?: {
    mode?: 'summary' | 'qa' | 'extract';
    query?: string;
  }
): void {
  const metrics: PDFAnalysisMetrics = {
    pageCount,
    textLength,
    analysisTimeMs,
    success,
    mode: options?.mode,
    hasQuery: !!options?.query,
  };

  logger.info('PDF analysis', {
    event: 'pdf_analysis',
    ...metrics,
  });

  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('PDF Analyzed', {
      pageCount,
      success,
      mode: options?.mode || 'summary',
      analysisTime: analysisTimeMs,
    });
  }
}

/**
 * Trackea uso general de features
 *
 * Para tracking de features que no tienen métricas específicas
 * @param feature - Nombre de la feature
 * @param action - Acción realizada
 * @param metadata - Datos adicionales
 */
export function trackFeatureUsage(
  feature: string,
  action: string,
  metadata?: Record<string, unknown>
): void {
  const metrics: FeatureUsageMetrics = {
    feature,
    action,
    metadata,
  };

  logger.info('Feature usage', {
    event: 'feature_usage',
    ...metrics,
  });

  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('Feature Used', {
      feature,
      action,
      ...metadata,
    });
  }
}

/**
 * Trackea errores de usuario
 *
 * Útil para identificar puntos de fricción en UX
 * @param feature - Feature donde ocurrió el error
 * @param errorCode - Código de error
 * @param errorMessage - Mensaje de error
 */
export function trackUserError(feature: string, errorCode: string, errorMessage: string): void {
  logger.warn('User error', {
    event: 'user_error',
    feature,
    errorCode,
    errorMessage,
  });

  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('User Error', {
      feature,
      errorCode,
      message: errorMessage,
    });
  }
}

/**
 * Trackea tiempo de carga de features
 *
 * Para medir performance de features pesadas
 * @param feature - Nombre de la feature
 * @param loadTimeMs - Tiempo de carga en ms
 */
export function trackFeatureLoadTime(feature: string, loadTimeMs: number): void {
  logger.debug('Feature load time', {
    event: 'feature_load_time',
    feature,
    loadTimeMs,
  });

  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track('Feature Loaded', {
      feature,
      loadTime: loadTimeMs,
    });
  }
}

/**
 * Helper para medir tiempo de ejecución de una función
 * @param fn - Función a medir
 * @param onComplete - Callback con tiempo de ejecución
 * @returns Resultado de la función
 * @example
 * ```typescript
 * const result = await measureExecutionTime(
 *   () => analyzePDF(content),
 *   (timeMs) => trackPDFAnalysis(pages, length, timeMs, true)
 * );
 * ```
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  onComplete?: (timeMs: number) => void
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const executionTime = Date.now() - startTime;
    if (onComplete) {
      onComplete(executionTime);
    }
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    if (onComplete) {
      onComplete(executionTime);
    }
    throw error;
  }
}

/**
 * Declaración de tipo para window.analytics (opcional)
 * Útil si se integra con Segment, Mixpanel, Amplitude, etc.
 */
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
      identify: (userId: string, traits?: Record<string, unknown>) => void;
      page: (name?: string, properties?: Record<string, unknown>) => void;
    };
  }
}

export {};
