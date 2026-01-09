/**
 * ActivitySummaryAIService - Servicio de generación de resúmenes con IA
 *
 * Extiende BaseAIService para generar resúmenes profesionales
 * de actividades de mantenimiento usando GROQ.
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

/**
 * Resultado de generación de resumen
 */
export interface SummaryGenerationResult {
  success: boolean;
  summary?: ActivitySummary;
  error?: string;
  cached?: boolean;
}

/**
 * Servicio para generar resúmenes de actividades con IA
 */
export class ActivitySummaryAIService extends BaseAIService {
  private groq: ReturnType<typeof createGroq>;

  /**
   *
   */
  constructor() {
    super({
      serviceName: 'ActivitySummaryAIService',
      timeoutMs: 30000,
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: 3600, // 1 hora
    });

    this.groq = createGroq({ apiKey: env.GROQ_API_KEY });
  }

  /**
   * Genera un resumen de actividades con IA
   * @returns Resultado con resumen generado
   */
  async generateSummary(request: ActivitySummaryRequest): Promise<SummaryGenerationResult> {
    try {
      // Validar request
      const validatedRequest = activitySummaryRequestSchema.parse(request);

      this.deps.logger?.info('Generando resumen de actividades', {
        serviceName: this.config.serviceName,
        assetType: validatedRequest.assetType,
        taskType: validatedRequest.taskType,
        style: validatedRequest.style,
        detailLevel: validatedRequest.detailLevel,
      });

      // Verificar caché
      const cacheKey = this.getCacheKey(validatedRequest);
      const cached = await this.checkCache<ActivitySummary>(cacheKey);

      if (cached) {
        this.deps.logger?.info('Resumen recuperado de caché', {
          serviceName: this.config.serviceName,
        });

        // Normalizar Date (viene como string del JSON)
        const normalizedSummary: ActivitySummary = {
          ...cached,
          createdAt:
            cached.createdAt instanceof Date ? cached.createdAt : new Date(cached.createdAt),
        };

        return {
          success: true,
          summary: normalizedSummary,
          cached: true,
        };
      }

      // Generar con IA usando retry logic
      const summary = await this.executeWithRetry(async () => {
        return this.callAI(validatedRequest);
      });

      // Guardar en caché
      await this.setCache(cacheKey, summary);

      this.deps.logger?.info('Resumen generado exitosamente', {
        serviceName: this.config.serviceName,
        summaryId: summary.id,
        sectionsCount: summary.sections.length,
      });

      return {
        success: true,
        summary,
      };
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

  /**
   * Llama a la IA para generar el resumen
   * @param request - Request validado
   * @returns Resumen generado
   */
  private async callAI(request: ActivitySummaryRequest): Promise<ActivitySummary> {
    const modelConfig = AI_TASK_MODELS.CHAT;

    // Construir prompt
    const userPrompt = buildSummaryPrompt({
      assetType: request.assetType,
      taskType: request.taskType,
      activities: request.activities,
      style: request.style,
      detailLevel: request.detailLevel,
      context: request.context,
    });

    // Llamar a GROQ
    const result = await generateText({
      model: this.groq(modelConfig.model),
      temperature: modelConfig.temperature,
      messages: [
        {
          role: 'system',
          content: SUMMARY_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parsear y validar respuesta
    const aiResponse = this.parseAIResponse(result.text);

    // Construir resumen completo
    const summary: ActivitySummary = {
      id: crypto.randomUUID(),
      title: aiResponse.title,
      executive: aiResponse.executive,
      sections: aiResponse.sections.map((section, index) => ({
        ...section,
        order: section.order ?? index,
      })),
      assetType: request.assetType,
      taskType: request.taskType,
      style: request.style,
      detailLevel: request.detailLevel,
      createdAt: new Date(),
      metadata: {
        wordCount: this.countWords(
          aiResponse.executive + aiResponse.sections.map((s) => s.content).join(' ')
        ),
        readingTime: Math.ceil(
          this.countWords(
            aiResponse.executive + aiResponse.sections.map((s) => s.content).join(' ')
          ) / 200
        ),
        generatedBy: 'ai',
        version: '1.0',
      },
    };

    return summary;
  }

  /**
   * Parsea la respuesta de la IA
   * @param rawResponse - Respuesta cruda de la IA
   * @returns Objeto parseado y validado
   */
  private parseAIResponse(rawResponse: string): AISummaryResponse {
    try {
      // Limpiar respuesta (remover markdown si existe)
      let cleanResponse = rawResponse.trim();

      // Remover bloques de código markdown
      const jsonMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1].trim();
      }

      // Parsear JSON
      const parsed = JSON.parse(cleanResponse);

      // Validar con schema
      const validated = aiSummaryResponseSchema.parse(parsed);

      return validated;
    } catch (error) {
      this.deps.logger?.error(
        'Error al parsear respuesta de IA',
        error instanceof Error ? error : new Error('Error desconocido'),
        {
          rawResponse: rawResponse.substring(0, 200),
        }
      );

      throw new Error('Respuesta de IA inválida');
    }
  }

  /**
   * Genera cache key única para el request
   * @param request - Request de generación
   * @returns Cache key
   */
  private getCacheKey(request: ActivitySummaryRequest): string {
    const parts = [
      'summary',
      request.assetType,
      request.taskType,
      request.style,
      request.detailLevel,
      request.activities.substring(0, 100), // Solo primeros 100 chars
    ];

    return parts.join(':');
  }

  /**
   * Cuenta palabras en un texto
   * @param text - Texto a analizar
   * @returns Número de palabras
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
