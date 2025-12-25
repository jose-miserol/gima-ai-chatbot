/**
 * ChecklistAIService - Servicio de generación de checklists con IA
 *
 * Extiende BaseAIService para proporcionar funcionalidad específica
 * de generación de checklists de mantenimiento usando GROQ.
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import { AI_TASK_MODELS, AI_CACHE_TTL, AI_TIMEOUTS } from '@/app/constants/ai';
import {
  CHECKLIST_SYSTEM_PROMPT,
  buildChecklistPrompt,
} from '@/app/config/prompts/checklist-generation';
import {
  checklistGenerationRequestSchema,
  checklistSchema,
  aiChecklistResponseSchema,
  type ChecklistGenerationRequest,
  type Checklist,
} from '@/app/lib/schemas/checklist.schema';
import { env } from '@/app/config/env';
import type { AssetType, TaskType } from '@/app/constants/ai';

/**
 * Resultado de generación de checklist
 */
export interface ChecklistGenerationResult {
  success: boolean;
  checklist?: Checklist;
  error?: string;
  cached?: boolean;
}

/**
 * Servicio para generar checklists con IA
 *
 * @example
 * ```typescript
 * const service = new ChecklistAIService();
 * const result = await service.generateChecklist({
 *   assetType: 'bomba',
 *   taskType: 'preventivo',
 *   customInstructions: 'Incluir verificación de temperatura'
 * });
 * ```
 */
export class ChecklistAIService extends BaseAIService {
  private groq: ReturnType<typeof createGroq>;

  constructor() {
    super({
      serviceName: 'ChecklistAIService',
      timeoutMs: AI_TIMEOUTS.NORMAL,
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: AI_CACHE_TTL.CHECKLIST,
    });

    this.groq = createGroq({ apiKey: env.GROQ_API_KEY });
  }

  /**
   * Genera un checklist de mantenimiento con IA
   *
   * @param request - Parámetros de generación
   * @returns Resultado con checklist generado
   */
  async generateChecklist(request: ChecklistGenerationRequest): Promise<ChecklistGenerationResult> {
    try {
      // 1. Validar request
      const validatedRequest = this.validate(checklistGenerationRequestSchema, request);

      // 2. Verificar cache
      const cacheKey = this.buildCacheKey([
        validatedRequest.assetType,
        validatedRequest.taskType,
        validatedRequest.customInstructions || 'default',
      ]);

      const cached = await this.checkCache<Checklist>(cacheKey);
      if (cached) {
        this.deps.logger?.info('Checklist from cache', {
          serviceName: this.config.serviceName,
          assetType: validatedRequest.assetType,
        });
        return { success: true, checklist: cached, cached: true };
      }

      // 3. Generar con IA y retry logic
      const checklist = await this.executeWithRetry(async () => {
        return this.callAI(
          validatedRequest.assetType,
          validatedRequest.taskType,
          validatedRequest.customInstructions
        );
      });

      // 4. Cachear resultado
      await this.setCache(cacheKey, checklist);

      return { success: true, checklist };
    } catch (error) {
      this.deps.logger?.error(
        'Failed to generate checklist',
        error instanceof Error ? error : new Error(String(error)),
        {
          serviceName: this.config.serviceName,
          assetType: request.assetType,
          taskType: request.taskType,
        }
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Llama a la API de GROQ para generar checklist
   */
  private async callAI(
    assetType: AssetType,
    taskType: TaskType,
    customInstructions?: string
  ): Promise<Checklist> {
    const modelConfig = AI_TASK_MODELS.CHECKLIST_GENERATION;
    const userPrompt = buildChecklistPrompt(assetType, taskType, customInstructions);

    this.deps.logger?.info('Calling GROQ for checklist generation', {
      serviceName: this.config.serviceName,
      model: modelConfig.model,
      assetType,
      taskType,
    });

    const result = await generateText({
      model: this.groq(modelConfig.model),
      temperature: modelConfig.temperature,
      messages: [
        {
          role: 'system',
          content: CHECKLIST_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parsear y validar respuesta
    const checklist = this.parseAIResponse(result.text, assetType, taskType);

    return checklist;
  }

  /**
   * Parsea y valida la respuesta de la IA
   */
  private parseAIResponse(rawText: string, assetType: AssetType, taskType: TaskType): Checklist {
    try {
      // Limpiar markdown si está presente
      const cleanJson = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);

      // Validar contra schema de IA
      const aiResponse = this.validate(aiChecklistResponseSchema, parsed);

      // Convertir a formato Checklist completo
      const checklist: Checklist = {
        id: crypto.randomUUID(),
        title: aiResponse.title,
        description: aiResponse.description,
        assetType,
        taskType,
        items: aiResponse.items.map((item, index) => ({
          id: crypto.randomUUID(),
          description: item.description,
          category: item.category as any, // Será validado por checklistSchema
          order: index,
          required: item.required,
          notes: item.notes,
        })),
        createdAt: new Date(),
        isTemplate: false,
        metadata: {
          generatedBy: 'ai',
          version: '1.0',
        },
      };

      // Validar checklist completo
      return this.validate(checklistSchema, checklist);
    } catch (error) {
      this.deps.logger?.error('Failed to parse AI response', error as Error, {
        serviceName: this.config.serviceName,
        rawText: rawText.slice(0, 200),
      });
      throw new Error('La IA generó un formato inválido');
    }
  }
}
