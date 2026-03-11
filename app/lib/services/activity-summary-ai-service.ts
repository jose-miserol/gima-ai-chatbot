/**
 * @file activity-summary-ai-service.ts
 * @module app/lib/ai/activity-summary-ai-service
 *
 * ============================================================
 * SERVICIO DE IA — GENERACIÓN DE RESÚMENES DE ACTIVIDADES
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `ActivitySummaryAIService`, que transforma notas técnicas crudas
 *   (lista de actividades realizadas en un mantenimiento) en un resumen
 *   profesional estructurado con título, resumen ejecutivo y secciones
 *   temáticas. El técnico elige el estilo (ejecutivo, técnico o narrativo)
 *   y el nivel de detalle (alto, medio, bajo).
 *
 * CONTEXTO EN GIMA:
 *   Al cerrar una orden de trabajo, los técnicos necesitan documentar lo que
 *   hicieron en un formato legible para supervisores, auditores y el historial
 *   del activo. Redactar ese resumen manualmente desde notas técnicas es lento.
 *   Este servicio lo automatiza: el técnico escribe sus notas en lenguaje
 *   natural y la IA las transforma en un documento profesional en segundos.
 *
 *   El flujo es: [ActivitySummary UI] → generateSummary → [cache hit?]
 *   → [GROQ API] → [validación Zod] → [ActivitySummary tipado]
 *
 * ESTILOS DE RESUMEN:
 *   - 'ejecutivo'  → Lenguaje gerencial, sin jerga técnica, foco en impacto y tiempo.
 *   - 'tecnico'    → Terminología precisa, métricas, especificaciones, lecturas.
 *   - 'narrativo'  → Redacción fluida y descriptiva, útil para informes de campo.
 *
 * NIVELES DE DETALLE:
 *   - 'alto'   → Incluye todas las observaciones, lecturas y pasos realizados.
 *   - 'medio'  → Balance entre completitud y concisión. Default recomendado.
 *   - 'bajo'   → Solo los hitos clave. Ideal para resúmenes ejecutivos rápidos.
 *
 * ESTRATEGIA DE CACHE:
 *   La cache key combina [assetType, taskType, style, detailLevel, activities(100chars)].
 *   Se incluyen los primeros 100 caracteres de las actividades para distinguir
 *   resúmenes de diferentes OTs sin almacenar el texto completo en la key.
 *   TTL: 3600s (1 hora). Los resúmenes son reproducibles: mismas actividades +
 *   mismo estilo → mismo resultado.
 *
 * NORMALIZACIÓN DE FECHA EN CACHE:
 *   JSON.parse convierte `createdAt` (Date) a string. Al recuperar del cache
 *   se normaliza explícitamente con `new Date(cached.createdAt)` para que el
 *   tipo siempre sea `Date` y no `string` en el objeto retornado a la UI.
 *
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

import { env } from '@/app/config/env';
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryPrompt,
} from '@/app/config/prompts/activity-summary-generation';
import { AI_TASK_MODELS } from '@/app/constants/ai';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import {
  activitySummaryRequestSchema,
  aiSummaryResponseSchema,
  type ActivitySummaryRequest,
  type ActivitySummary,
  type AISummaryResponse,
} from '@/app/lib/schemas/activity-summary.schema';

// ============================================================
// TIPOS DE RESULTADO
// ============================================================

/**
 * Resultado de la generación de un resumen de actividades.
 *
 * @property success - Indica si la generación fue exitosa.
 * @property summary - Resumen generado y validado. Presente si success=true.
 * @property error   - Mensaje de error legible. Presente si success=false.
 * @property cached  - True si el resultado vino del cache (no se llamó al LLM).
 */
export interface SummaryGenerationResult {
  success: boolean;
  summary?: ActivitySummary;
  error?: string;
  cached?: boolean;
}

// ============================================================
// SERVICIO: ActivitySummaryAIService
// ============================================================

/**
 * Servicio de generación de resúmenes de actividades de mantenimiento con IA.
 *
 * Extiende `BaseAIService` para heredar retry logic, cache y validación Zod.
 *
 * @example
 * ```typescript
 * const service = new ActivitySummaryAIService();
 * const result = await service.generateSummary({
 *   assetType: 'compresor',
 *   taskType: 'preventivo',
 *   activities: 'Revisé correas, cambié filtro de aire, lubrique rodamientos...',
 *   style: 'tecnico',
 *   detailLevel: 'alto'
 * });
 *
 * if (result.success) {
 *   displaySummary(result.summary);
 * }
 * ```
 */
export class ActivitySummaryAIService extends BaseAIService {
  /** Cliente GROQ configurado con la API key del entorno. */
  private groq: ReturnType<typeof createGroq>;

  constructor() {
    super({
      serviceName: 'ActivitySummaryAIService',
      timeoutMs: 30000,
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: 3600, // 1 hora: resúmenes son reproducibles y cambian poco
    });

    this.groq = createGroq({ apiKey: env.GROQ_API_KEY });
  }

  // ============================================================
  // MÉTODO PÚBLICO
  // ============================================================

  /**
   * Genera un resumen profesional de actividades de mantenimiento.
   *
   * Captura todos los errores internamente y los retorna como `{ success: false, error }`,
   * de modo que el caller no necesita envolver la llamada en try/catch.
   *
   * @param request - Parámetros de generación:
   *   - `assetType`    → Tipo de activo sobre el que se realizó el mantenimiento.
   *   - `taskType`     → Tipo de tarea ejecutada.
   *   - `activities`   → Notas crudas del técnico (10-5000 chars).
   *   - `style`        → Estilo del resumen ('ejecutivo' | 'tecnico' | 'narrativo').
   *   - `detailLevel`  → Nivel de detalle ('alto' | 'medio' | 'bajo').
   *   - `context`      → Contexto adicional opcional (máx 500 chars).
   * @returns Resultado con el resumen tipado o mensaje de error.
   */
  async generateSummary(request: ActivitySummaryRequest): Promise<SummaryGenerationResult> {
    try {
      // Paso 1: Validar request con schema Zod.
      const validatedRequest = activitySummaryRequestSchema.parse(request);

      this.deps.logger?.info('Generando resumen de actividades', {
        serviceName: this.config.serviceName,
        assetType: validatedRequest.assetType,
        taskType: validatedRequest.taskType,
        style: validatedRequest.style,
        detailLevel: validatedRequest.detailLevel,
      });

      // Paso 2: Verificar cache.
      const cacheKey = this.getCacheKey(validatedRequest);
      const cached = await this.checkCache<ActivitySummary>(cacheKey);

      if (cached) {
        this.deps.logger?.info('Resumen recuperado de caché', {
          serviceName: this.config.serviceName,
        });

        // Normalizar createdAt: JSON.parse convierte Date a string,
        // así que se reconstruye el objeto Date explícitamente.
        const normalizedSummary: ActivitySummary = {
          ...cached,
          createdAt:
            cached.createdAt instanceof Date ? cached.createdAt : new Date(cached.createdAt),
        };

        return { success: true, summary: normalizedSummary, cached: true };
      }

      // Paso 3: Generar con GROQ + retry logic.
      const summary = await this.executeWithRetry(async () => {
        return this.callAI(validatedRequest);
      });

      // Paso 4: Guardar en cache.
      await this.setCache(cacheKey, summary);

      this.deps.logger?.info('Resumen generado exitosamente', {
        serviceName: this.config.serviceName,
        summaryId: summary.id,
        sectionsCount: summary.sections.length,
      });

      return { success: true, summary };
    } catch (error) {
      this.deps.logger?.error(
        'Error al generar resumen',
        error instanceof Error ? error : new Error('Error desconocido')
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar resumen',
      };
    }
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Llama a la API de GROQ para generar el resumen y lo retorna validado.
   *
   * @param request - Request ya validado con activitySummaryRequestSchema.
   * @returns ActivitySummary completo con UUID, timestamps y metadata.
   * @throws Error si GROQ falla o la respuesta tiene formato inválido.
   */
  private async callAI(request: ActivitySummaryRequest): Promise<ActivitySummary> {
    const modelConfig = AI_TASK_MODELS.CHAT;

    const userPrompt = buildSummaryPrompt({
      assetType: request.assetType,
      taskType: request.taskType,
      activities: request.activities,
      style: request.style,
      detailLevel: request.detailLevel,
      context: request.context,
    });

    const result = await generateText({
      model: this.groq(modelConfig.model),
      temperature: modelConfig.temperature,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const aiResponse = this.parseAIResponse(result.text);

    // Construir ActivitySummary completo enriqueciendo la respuesta del LLM
    // con campos generados por la aplicación (ID, timestamps, metadata).
    const totalText = aiResponse.executive + aiResponse.sections.map((s) => s.content).join(' ');

    const summary: ActivitySummary = {
      id: crypto.randomUUID(),
      title: aiResponse.title,
      executive: aiResponse.executive,
      sections: aiResponse.sections.map((section, index) => ({
        ...section,
        order: section.order ?? index, // Respetar el orden del LLM si lo provee
      })),
      assetType: request.assetType,
      taskType: request.taskType,
      style: request.style,
      detailLevel: request.detailLevel,
      createdAt: new Date(),
      metadata: {
        wordCount: this.countWords(totalText),
        // Estimación estándar de lectura: ~200 palabras por minuto
        readingTime: Math.ceil(this.countWords(totalText) / 200),
        generatedBy: 'ai',
        version: '1.0',
      },
    };

    return summary;
  }

  /**
   * Parsea y valida el texto JSON devuelto por GROQ.
   *
   * Limpia bloques markdown antes de parsear para manejar casos donde
   * el modelo incluye ```json ... ``` aunque el prompt especifique JSON puro.
   *
   * @param rawResponse - Texto crudo de la respuesta del LLM.
   * @returns Objeto AISummaryResponse validado con aiSummaryResponseSchema.
   * @throws Error si el JSON es inválido o no cumple el schema.
   */
  private parseAIResponse(rawResponse: string): AISummaryResponse {
    try {
      let cleanResponse = rawResponse.trim();

      // Extraer JSON de dentro de un bloque de código markdown si existe
      const jsonMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(cleanResponse);
      return aiSummaryResponseSchema.parse(parsed);
    } catch (error) {
      this.deps.logger?.error(
        'Error al parsear respuesta de IA',
        error instanceof Error ? error : new Error('Error desconocido'),
        { rawResponse: rawResponse.substring(0, 200) }
      );

      throw new Error('Respuesta de IA inválida');
    }
  }

  /**
   * Genera la cache key para el request dado.
   *
   * Usa solo los primeros 100 caracteres de `activities` para mantener
   * la key corta sin perder capacidad de distinguir distintas OTs.
   *
   * @param request - Request validado de generación de resumen.
   * @returns Cache key con formato `summary:assetType:taskType:style:detailLevel:activities(100)`.
   */
  private getCacheKey(request: ActivitySummaryRequest): string {
    return [
      'summary',
      request.assetType,
      request.taskType,
      request.style,
      request.detailLevel,
      request.activities.substring(0, 100),
    ].join(':');
  }

  /**
   * Cuenta las palabras en un texto para calcular tiempo de lectura estimado.
   * @param text - Texto a analizar.
   * @returns Número de palabras (split por uno o más espacios/saltos de línea).
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
