/**
 * @file checklist-ai-service.ts
 * @module app/lib/ai/checklist-ai-service
 *
 * ============================================================
 * SERVICIO DE IA — GENERACIÓN DE CHECKLISTS DE MANTENIMIENTO
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `ChecklistAIService`, que genera checklists de mantenimiento
 *   personalizados usando GROQ (llama). Dado el tipo de activo y el tipo
 *   de tarea, el modelo produce un checklist completo con ítems ordenados,
 *   categorizados y con indicador de obligatoriedad.
 *
 *   El resultado se valida con Zod antes de retornarlo al caller, garantizando
 *   que la UI siempre recibe datos con el formato correcto.
 *
 * CONTEXTO EN GIMA:
 *   Los técnicos de mantenimiento necesitan checklists específicos para cada
 *   combinación de activo + tarea. Un mantenimiento preventivo en una bomba
 *   hidráulica tiene ítems completamente diferentes a uno en un compresor de
 *   aire. En lugar de mantener cientos de plantillas estáticas, GIMA genera
 *   checklists dinámicos con IA bajo demanda.
 *
 *   El flujo es: [ChecklistBuilder UI] → generateChecklist → [cache hit?] →
 *   [GROQ API] → [validación Zod] → [Checklist tipado]
 *
 * POR QUÉ GROQ Y NO GEMINI:
 *   Los checklists son texto estructurado puro (sin imágenes ni PDFs).
 *   GROQ con llama ofrece latencia < 1s para este tipo de output, lo que
 *   hace la experiencia de generación percibida como instantánea. Gemini
 *   se reserva para las features multimodales del proyecto.
 *
 * ESTRATEGIA DE CACHE:
 *   Los checklists para la misma combinación [assetType + taskType +
 *   customInstructions] son deterministas: el mismo input produce el mismo
 *   output. Se cachean durante `AI_CACHE_TTL.CHECKLIST` segundos para evitar
 *   llamadas redundantes a la API. La cache key incluye las instrucciones
 *   personalizadas (o 'default' si no hay) para evitar colisiones.
 *
 * FLUJO INTERNO (generateChecklist):
 *   1. Validar request con checklistGenerationRequestSchema.
 *   2. Buscar en cache (si hay hit → retornar con cached: true).
 *   3. Llamar a GROQ via callAI() con retry logic (BaseAIService).
 *   4. Parsear respuesta JSON limpiando bloques markdown.
 *   5. Validar con aiChecklistResponseSchema → convertir a Checklist completo.
 *   6. Validar Checklist completo con checklistSchema.
 *   7. Guardar en cache y retornar.
 *
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

import { env } from '@/app/config/env';
import {
  CHECKLIST_SYSTEM_PROMPT,
  buildChecklistPrompt,
} from '@/app/config/prompts/checklist-generation';
import { AI_TASK_MODELS, AI_CACHE_TTL, AI_TIMEOUTS } from '@/app/constants/ai';
import type { AssetType, TaskType } from '@/app/constants/ai';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import {
  checklistGenerationRequestSchema,
  checklistSchema,
  aiChecklistResponseSchema,
  type ChecklistGenerationRequest,
  type Checklist,
} from '@/app/lib/schemas/checklist.schema';

// ============================================================
// TIPOS DE RESULTADO
// ============================================================

/**
 * Resultado de la generación de un checklist.
 *
 * @property success   - Indica si la generación fue exitosa.
 * @property checklist - Checklist generado y validado. Presente si success=true.
 * @property error     - Mensaje de error legible. Presente si success=false.
 * @property cached    - True si el resultado vino del cache (no se llamó al LLM).
 *                       Útil para métricas de uso y debugging.
 */
export interface ChecklistGenerationResult {
  success: boolean;
  checklist?: Checklist;
  error?: string;
  cached?: boolean;
}

// ============================================================
// SERVICIO: ChecklistAIService
// ============================================================

/**
 * Servicio de generación de checklists de mantenimiento con IA.
 *
 * Extiende `BaseAIService` para heredar retry logic, cache y validación Zod.
 * Cada instancia tiene su propio cliente GROQ configurado con la API key del entorno.
 *
 * @example
 * ```typescript
 * const service = new ChecklistAIService();
 * const result = await service.generateChecklist({
 *   assetType: 'bomba',
 *   taskType: 'preventivo',
 *   customInstructions: 'Incluir verificación de temperatura del motor'
 * });
 *
 * if (result.success) {
 *   preloadForm(result.checklist);
 * }
 * ```
 */
export class ChecklistAIService extends BaseAIService {
  /** Cliente GROQ configurado con la API key del entorno. */
  private groq: ReturnType<typeof createGroq>;

  constructor() {
    super({
      serviceName: 'ChecklistAIService',
      timeoutMs: AI_TIMEOUTS.NORMAL, // Timeout estándar: suficiente para un checklist de ~20 ítems
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: AI_CACHE_TTL.CHECKLIST, // Definido en constants/ai.ts
    });

    this.groq = createGroq({ apiKey: env.GROQ_API_KEY });
  }

  // ============================================================
  // MÉTODO PÚBLICO
  // ============================================================

  /**
   * Genera un checklist de mantenimiento personalizado con IA.
   *
   * Implementa el flujo completo: validación → cache → LLM → validación → cache.
   * Captura todos los errores internamente y los retorna como `{ success: false, error }`,
   * de modo que el caller no necesita envolver la llamada en try/catch.
   *
   * @param request - Parámetros de generación:
   *   - `assetType`          → Tipo de activo ('bomba', 'compresor', 'hvac', etc.)
   *   - `taskType`           → Tipo de tarea ('preventivo', 'correctivo', 'predictivo')
   *   - `customInstructions` → Instrucciones adicionales del técnico (máx 500 chars)
   *   - `context`            → Contexto adicional del equipo (máx 200 chars)
   * @returns Resultado con el checklist tipado o mensaje de error.
   */
  async generateChecklist(request: ChecklistGenerationRequest): Promise<ChecklistGenerationResult> {
    try {
      // Paso 1: Validar request con schema Zod.
      // Rechaza tipos de activo/tarea fuera del enum y textos demasiado largos.
      const validatedRequest = this.validate(checklistGenerationRequestSchema, request);

      // Paso 2: Verificar cache antes de llamar al LLM.
      // La key incluye las instrucciones personalizadas para no mezclar
      // checklists con diferentes instrucciones del mismo assetType+taskType.
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

      // Paso 3: Generar con GROQ + retry logic.
      // executeWithRetry (BaseAIService) gestiona los reintentos automáticamente.
      const checklist = await this.executeWithRetry(async () => {
        return this.callAI(
          validatedRequest.assetType,
          validatedRequest.taskType,
          validatedRequest.customInstructions
        );
      });

      // Paso 4: Guardar en cache para futuras solicitudes idénticas.
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

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Llama a la API de GROQ para generar el checklist y lo retorna validado.
   *
   * Responsabilidades:
   *   1. Construir el prompt del usuario con `buildChecklistPrompt`.
   *   2. Llamar a `generateText` con el modelo y temperatura del config.
   *   3. Parsear y validar la respuesta con `parseAIResponse`.
   *
   * @param assetType          - Tipo de activo del checklist.
   * @param taskType           - Tipo de tarea del checklist.
   * @param customInstructions - Instrucciones personalizadas del técnico.
   * @returns Checklist completo validado con checklistSchema.
   * @throws Error si GROQ falla o la respuesta tiene formato inválido.
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
        { role: 'system', content: CHECKLIST_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    return this.parseAIResponse(result.text, assetType, taskType);
  }

  /**
   * Parsea el texto JSON devuelto por GROQ y lo convierte en un Checklist tipado.
   *
   * PASOS:
   *   1. Limpiar bloques de código markdown (```json ... ```) si el modelo los incluye.
   *   2. JSON.parse para obtener el objeto crudo.
   *   3. Validar contra aiChecklistResponseSchema (formato mínimo del LLM).
   *   4. Construir el Checklist completo añadiendo UUIDs, timestamps y metadata.
   *   5. Validar el Checklist completo con checklistSchema (formato final de GIMA).
   *
   * POR QUÉ DOS VALIDACIONES:
   *   - `aiChecklistResponseSchema` valida el formato que el LLM debe retornar
   *     (más permisivo, sin campos como `id` o `createdAt` que el LLM no genera).
   *   - `checklistSchema` valida el Checklist completo que se almacena y retorna
   *     a la UI (incluye todos los campos requeridos por la aplicación).
   *
   * @param rawText   - Texto crudo de la respuesta del LLM.
   * @param assetType - Tipo de activo para incluir en el Checklist final.
   * @param taskType  - Tipo de tarea para incluir en el Checklist final.
   * @returns Checklist completo y validado.
   * @throws Error si el JSON es inválido o no cumple el schema.
   */
  private parseAIResponse(rawText: string, assetType: AssetType, taskType: TaskType): Checklist {
    try {
      const cleanJson = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      const aiResponse = this.validate(aiChecklistResponseSchema, parsed);

      // Construir Checklist completo enriqueciendo la respuesta del LLM
      // con los campos que la aplicación necesita (IDs, timestamps, metadata).
      const checklist: Checklist = {
        id: crypto.randomUUID(),
        title: aiResponse.title,
        description: aiResponse.description,
        assetType,
        taskType,
        items: aiResponse.items.map((item, index) => ({
          id: crypto.randomUUID(),
          description: item.description,
          category: item.category as any, // Será validado por checklistSchema abajo
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

      // Validación final: asegura que el checklist construido cumple con el
      // schema completo de GIMA, incluyendo rangos de items y longitudes de texto.
      return this.validate(checklistSchema, checklist);
    } catch (error) {
      this.deps.logger?.error('Failed to parse AI response', error as Error, {
        serviceName: this.config.serviceName,
        rawText: rawText.slice(0, 200), // Solo los primeros 200 chars para no saturar el log
      });
      throw new Error('La IA generó un formato inválido');
    }
  }
}
