/**
 * WorkOrderCloseoutAIService - Servicio de generación de notas de cierre con IA
 *
 * Extiende BaseAIService para generar notas de cierre profesionales
 * para Work Orders usando GROQ.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import { AI_TASK_MODELS } from '@/app/constants/ai';
import {
  CLOSEOUT_SYSTEM_PROMPT,
  buildCloseoutPrompt,
} from '@/app/config/prompts/closeout-generation';
import {
  closeoutNotesRequestSchema,
  aiCloseoutNotesSchema,
  type CloseoutNotesRequest,
  type AICloseoutNotes,
} from '@/app/lib/schemas/work-order-closeout.schema';
import type { CloseoutNotes } from '@/app/components/features/work-order-closeout/types';

/**
 * Resultado de generación de notas de cierre
 */
export interface CloseoutGenerationResult {
  success: boolean;
  notes?: CloseoutNotes;
  error?: string;
  cached?: boolean;
}

/**
 * Servicio para generar notas de cierre con IA
 */
export class WorkOrderCloseoutAIService extends BaseAIService {
  private groq: ReturnType<typeof createGroq>;

  constructor() {
    super({
      serviceName: 'WorkOrderCloseoutAIService',
      timeoutMs: 30000,
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: 1800, // 30 minutos
    });

    this.groq = createGroq();
  }

  /**
   * Genera notas de cierre para un Work Order
   *
   * @param request - Parámetros de generación
   * @returns Resultado con notas generadas
   */
  async generateCloseoutNotes(request: CloseoutNotesRequest): Promise<CloseoutGenerationResult> {
    try {
      // Validar request
      const validatedRequest = closeoutNotesRequestSchema.parse(request);

      this.deps.logger?.info('Generando notas de cierre', {
        workOrderId: validatedRequest.workOrderId,
        style: validatedRequest.style,
      });

      // Verificar caché
      const cacheKey = this.getCacheKey(validatedRequest);
      const cached = await this.checkCache<CloseoutNotes>(cacheKey);

      if (cached) {
        this.deps.logger?.info('Notas recuperadas de caché');
        return { success: true, notes: cached, cached: true };
      }

      // Generar con IA usando retry logic
      const notes = await this.executeWithRetry(async () => {
        return this.callAI(validatedRequest);
      });

      // Guardar en caché
      await this.setCache(cacheKey, notes);

      this.deps.logger?.info('Notas generadas exitosamente', {
        notesId: notes.id,
      });

      return { success: true, notes };
    } catch (error) {
      this.deps.logger?.error(
        'Error al generar notas',
        error instanceof Error ? error : new Error('Error desconocido')
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar notas de cierre',
      };
    }
  }

  /**
   * Llama a la IA para generar las notas
   */
  private async callAI(request: CloseoutNotesRequest): Promise<CloseoutNotes> {
    const modelConfig = AI_TASK_MODELS.CHAT;
    const { workOrderData } = request;

    // Construir prompt
    const userPrompt = buildCloseoutPrompt({
      workOrderId: request.workOrderId,
      title: workOrderData.title,
      description: workOrderData.description,
      assetType: workOrderData.assetType,
      taskType: workOrderData.taskType,
      priority: workOrderData.priority,
      activities: workOrderData.activities,
      materialsUsed: workOrderData.materialsUsed,
      timeSpent: workOrderData.timeSpent,
      issues: workOrderData.issues,
      style: request.style,
      includeRecommendations: request.includeRecommendations,
    });

    // Llamar a GROQ
    const result = await generateText({
      model: this.groq(modelConfig.model),
      temperature: modelConfig.temperature,
      messages: [
        { role: 'system', content: CLOSEOUT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    // Parsear y validar respuesta
    const aiResponse = this.parseAIResponse(result.text);

    // Construir notas completas
    const notes: CloseoutNotes = {
      id: crypto.randomUUID(),
      workOrderId: request.workOrderId,
      summary: aiResponse.summary,
      workPerformed: aiResponse.workPerformed,
      findings: aiResponse.findings,
      recommendations: aiResponse.recommendations,
      materialsUsed: aiResponse.materialsUsed,
      timeBreakdown: aiResponse.timeBreakdown,
      nextActions: aiResponse.nextActions,
      style: request.style,
      createdAt: new Date(),
      metadata: {
        wordCount: this.countWords(
          aiResponse.summary +
            aiResponse.workPerformed +
            aiResponse.findings +
            (aiResponse.recommendations || '')
        ),
        generatedBy: 'ai',
        version: '1.0',
      },
    };

    return notes;
  }

  /**
   * Parsea la respuesta de la IA
   */
  private parseAIResponse(rawResponse: string): AICloseoutNotes {
    try {
      let cleanResponse = rawResponse.trim();

      // Remover bloques de código markdown
      const jsonMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1].trim();
      }

      // Parsear JSON
      const parsed = JSON.parse(cleanResponse);

      // Validar con schema
      const validated = aiCloseoutNotesSchema.parse(parsed);

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
   * Genera cache key única
   */
  private getCacheKey(request: CloseoutNotesRequest): string {
    const parts = [
      'closeout',
      request.workOrderId,
      request.style,
      request.includeRecommendations ? 'with-rec' : 'no-rec',
      request.workOrderData.activities.slice(0, 2).join(':'),
    ];

    return parts.join(':');
  }

  /**
   * Cuenta palabras en un texto
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
