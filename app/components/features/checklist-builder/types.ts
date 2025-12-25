/**
 * Tipos para el Smart Checklist Builder
 *
 * Define las interfaces y tipos TypeScript para la generación
 * de checklists de mantenimiento con IA.
 */

import type { AssetType, TaskType } from '@/app/constants/ai';

/**
 * Request para generar checklist con IA
 */
export interface ChecklistGenerationRequest {
  /**
   * Tipo de activo (bomba, caldera, etc.)
   */
  assetType: AssetType;

  /**
   * Tipo de tarea de mantenimiento
   */
  taskType: TaskType;

  /**
   * Instrucciones personalizadas del usuario (opcional)
   */
  customInstructions?: string;

  /**
   * Contexto adicional (ubicación, modelo específico, etc.)
   */
  context?: string;
}

/**
 * Item individual de un checklist
 */
export interface ChecklistItem {
  /**
   * ID único del item
   */
  id: string;

  /**
   * Descripción de la tarea a verificar
   */
  description: string;

  /**
   * Categoría del item (seguridad, operación, etc.)
   */
  category: string;

  /**
   * Orden del item en el checklist
   */
  order: number;

  /**
   * Si el item es obligatorio (crítico)
   */
  required: boolean;

  /**
   * Notas o detalles adicionales
   */
  notes?: string;
}

/**
 * Checklist completo generado
 */
export interface Checklist {
  /**
   * ID único del checklist
   */
  id: string;

  /**
   * Nombre del checklist
   */
  title: string;

  /**
   * Descripción general
   */
  description: string;

  /**
   * Tipo de activo
   */
  assetType: AssetType;

  /**
   * Tipo de tarea
   */
  taskType: TaskType;

  /**
   * Items del checklist
   */
  items: ChecklistItem[];

  /**
   * Fecha de creación
   */
  createdAt: Date;

  /**
   * Si es una plantilla guardada
   */
  isTemplate: boolean;

  /**
   * Metadata adicional
   */
  metadata?: {
    generatedBy?: 'ai' | 'manual';
    version?: string;
    tags?: string[];
  };
}

/**
 * Template de checklist guardado
 */
export interface ChecklistTemplate {
  /**
   * ID del template
   */
  id: string;

  /**
   * Nombre del template
   */
  name: string;

  /**
   * Checklist asociado
   */
  checklist: Checklist;

  /**
   * Número de veces usado
   */
  usageCount: number;

  /**
   * Fecha de última modificación
   */
  updatedAt: Date;
}

/**
 * Estado del hook de generación
 */
export interface ChecklistGenerationState {
  /**
   * Si está generando actualmente
   */
  isGenerating: boolean;

  /**
   * Checklist generado (null si aún no se ha generado)
   */
  checklist: Checklist | null;

  /**
   * Error si la generación falló
   */
  error: Error | null;

  /**
   * Progreso de generación (0-100)
   */
  progress: number;
}
