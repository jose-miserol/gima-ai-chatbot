/**
 * @file work-order-closeout-ai-service.ts
 * @module app/lib/ai/work-order-closeout-ai-service
 *
 * ============================================================
 * SERVICIO DE IA — GENERACIÓN DE NOTAS DE CIERRE DE OT
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone `WorkOrderCloseoutAIService`, que genera notas de cierre
 *   profesionales para Órdenes de Trabajo (OT). A partir de los datos
 *   del work order (actividades, materiales, tiempo, hallazgos), el modelo
 *   produce un documento estructurado con: resumen ejecutivo, trabajo
 *   realizado, hallazgos, materiales utilizados, desglose de tiempo,
 *   recomendaciones y próximas acciones.
 *
 * CONTEXTO EN GIMA:
 *   El cierre de una OT requiere documentación formal para el historial del
 *   activo y para auditorías de mantenimiento. Los técnicos tienen que
 *   rellenar formularios de texto detallados que con frecuencia quedan
 *   incompletos o en lenguaje coloquial. Este servicio genera el documento
 *   en el estilo correcto (formal, técnico o breve) con un solo click,
 *   usando como input los datos que ya existen en la OT.
 *
 *   El flujo es: [WorkOrderCloseout UI] → generateCloseoutNotes → [cache hit?]
 *   → [GROQ API] → [validación Zod] → [CloseoutNotes tipado]
 *
 * ESTILOS DE NOTAS:
 *   - 'formal'    → Redacción corporativa para reportes a dirección o clientes.
 *   - 'technical' → Lenguaje de ingeniería con métricas, tolerancias y códigos.
 *   - 'brief'     → Resumen conciso para seguimientos rápidos o historial simplificado.
 *
 * ESTRATEGIA DE CACHE:
 *   La cache key incluye: workOrderId, style, flag de recomendaciones y las
 *   primeras 2 actividades. Esto captura los determinantes principales del
 *   contenido sin almacenar toda la data de la OT en la key.
 *   TTL: 1800s (30 minutos). Las notas de cierre son más específicas por OT
 *   que los checklists, por lo que un TTL más corto reduce el riesgo de servir
 *   notas stale si la OT se edita entre generaciones.
 *
 * DIFERENCIA CON ActivitySummaryAIService:
 *   - ActivitySummary: texto libre de actividades → resumen en secciones.
 *   - WorkOrderCloseout: datos estructurados de la OT (con IDs, prioridades,
 *     materiales, tiempo) → documento de cierre formal con campos específicos
 *     requeridos por el proceso de cierre de GIMA.
 *
 */

import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

import type { CloseoutNotes } from '@/app/components/features/ai-tools/work-order-closeout/types';
import {
  CLOSEOUT_SYSTEM_PROMPT,
  buildCloseoutPrompt,
} from '@/app/config/prompts/closeout-generation';
import { AI_TASK_MODELS } from '@/app/constants/ai';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import {
  closeoutNotesRequestSchema,
  aiCloseoutNotesSchema,
  type CloseoutNotesRequest,
  type AICloseoutNotes,
} from '@/app/lib/schemas/work-order-closeout.schema';

// ============================================================
// TIPOS DE RESULTADO
// ============================================================

/**
 * Resultado de la generación de notas de cierre.
 *
 * @property success - Indica si la generación fue exitosa.
 * @property notes   - Notas de cierre generadas y validadas. Presente si success=true.
 * @property error   - Mensaje de error legible. Presente si success=false.
 * @property cached  - True si el resultado vino del cache (no se llamó al LLM).
 */
export interface CloseoutGenerationResult {
  success: boolean;
  notes?: CloseoutNotes;
  error?: string;
  cached?: boolean;
}

// ============================================================
// SERVICIO: WorkOrderCloseoutAIService
// ============================================================

/**
 * Servicio de generación de notas de cierre de OT con IA.
 *
 * Extiende `BaseAIService` para heredar retry logic, cache y validación Zod.
 *
 * @example
 * ```typescript
 * const service = new WorkOrderCloseoutAIService();
 * const result = await service.generateCloseoutNotes({
 *   workOrderId: 'wo-123',
 *   workOrderData: {
 *     title: 'Mantenimiento preventivo compresor K-101',
 *     activities: ['Cambio de aceite', 'Revisión de válvulas', 'Prueba de presión'],
 *     timeSpent: 3.5,
 *     // ...
 *   },
 *   style: 'technical',
 *   includeRecommendations: true,
 * });
 *
 * if (result.success) {
 *   prefillCloseoutForm(result.notes);
 * }
 * ```
 */
export class WorkOrderCloseoutAIService extends BaseAIService {
  /** Cliente GROQ configurado con la API key del entorno. */
  private groq: ReturnType<typeof createGroq>;

  constructor() {
    super({
      serviceName: 'WorkOrderCloseoutAIService',
      timeoutMs: 30000,
      maxRetries: 3,
      enableCaching: true,
      cacheTTL: 1800, // 30 minutos: TTL más corto que checklists (datos de OT pueden cambiar)
    });

    // Sin API key explícita — createGroq lee GROQ_API_KEY del entorno automáticamente
    this.groq = createGroq();
  }

  // ============================================================
  // MÉTODO PÚBLICO
  // ============================================================

  /**
   * Genera notas de cierre profesionales para una Orden de Trabajo.
   *
   * Captura todos los errores internamente y los retorna como `{ success: false, error }`,
   * de modo que el caller no necesita envolver la llamada en try/catch.
   *
   * @param request - Parámetros de generación:
   *   - `workOrderId`             → ID de la OT (para cache key y referencia).
   *   - `workOrderData`           → Datos completos de la OT (validados por workOrderSummarySchema).
   *   - `style`                   → Estilo de redacción ('formal' | 'technical' | 'brief').
   *   - `includeRecommendations`  → Si incluir sección de recomendaciones. Default true.
   * @returns Resultado con las notas de cierre tipadas o mensaje de error.
   */
  async generateCloseoutNotes(request: CloseoutNotesRequest): Promise<CloseoutGenerationResult> {
    try {
      // Paso 1: Validar request con schema Zod.
      const validatedRequest = closeoutNotesRequestSchema.parse(request);

      this.deps.logger?.info('Generando notas de cierre', {
        workOrderId: validatedRequest.workOrderId,
        style: validatedRequest.style,
      });

      // Paso 2: Verificar cache.
      const cacheKey = this.getCacheKey(validatedRequest);
      const cached = await this.checkCache<CloseoutNotes>(cacheKey);

      if (cached) {
        this.deps.logger?.info('Notas recuperadas de caché');
        return { success: true, notes: cached, cached: true };
      }

      // Paso 3: Generar con GROQ + retry logic.
      const notes = await this.executeWithRetry(async () => {
        return this.callAI(validatedRequest);
      });

      // Paso 4: Guardar en cache.
      await this.setCache(cacheKey, notes);

      this.deps.logger?.info('Notas generadas exitosamente', { notesId: notes.id });

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

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Llama a la API de GROQ para generar las notas de cierre y las retorna validadas.
   *
   * Construye el prompt usando `buildCloseoutPrompt` con todos los datos de la OT
   * y el estilo seleccionado, luego parsea y valida la respuesta JSON del modelo.
   *
   * @param request - Request ya validado con closeoutNotesRequestSchema.
   * @returns CloseoutNotes completo con UUID, timestamps, metadata y wordCount.
   * @throws Error si GROQ falla o la respuesta tiene formato inválido.
   */
  private async callAI(request: CloseoutNotesRequest): Promise<CloseoutNotes> {
    const modelConfig = AI_TASK_MODELS.CHAT;
    const { workOrderData } = request;

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

    const result = await generateText({
      model: this.groq(modelConfig.model),
      temperature: modelConfig.temperature,
      messages: [
        { role: 'system', content: CLOSEOUT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const aiResponse = this.parseAIResponse(result.text);

    // Construir CloseoutNotes completo enriqueciendo la respuesta del LLM.
    const fullText =
      aiResponse.summary +
      aiResponse.workPerformed +
      aiResponse.findings +
      (aiResponse.recommendations || '');

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
        wordCount: this.countWords(fullText),
        generatedBy: 'ai',
        version: '1.0',
      },
    };

    return notes;
  }

  /**
   * Parsea y valida el texto JSON devuelto por GROQ.
   *
   * Extrae JSON de bloques markdown si el modelo los incluye, luego valida
   * contra `aiCloseoutNotesSchema` para garantizar que todos los campos
   * requeridos están presentes con los tipos correctos.
   *
   * @param rawResponse - Texto crudo de la respuesta del LLM.
   * @returns Objeto AICloseoutNotes validado con aiCloseoutNotesSchema.
   * @throws Error si el JSON es inválido o no cumple el schema.
   */
  private parseAIResponse(rawResponse: string): AICloseoutNotes {
    try {
      let cleanResponse = rawResponse.trim();

      // Extraer JSON de bloque markdown si existe
      const jsonMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(cleanResponse);
      return aiCloseoutNotesSchema.parse(parsed);
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
   * Incluye las primeras 2 actividades para distinguir notas de diferentes OTs
   * con el mismo workOrderId pero actividades distintas (re-generaciones).
   *
   * @param request - Request validado de generación de notas.
   * @returns Cache key con formato `closeout:workOrderId:style:rec-flag:act1:act2`.
   */
  private getCacheKey(request: CloseoutNotesRequest): string {
    return [
      'closeout',
      request.workOrderId,
      request.style,
      request.includeRecommendations ? 'with-rec' : 'no-rec',
      request.workOrderData.activities.slice(0, 2).join(':'),
    ].join(':');
  }

  /**
   * Cuenta las palabras en un texto para la metadata de wordCount.
   * @param text - Texto a analizar.
   * @returns Número de palabras.
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
