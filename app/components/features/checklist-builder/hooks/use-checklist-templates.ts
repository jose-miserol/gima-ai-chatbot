/**
 * useChecklistTemplates - Hook para gestión de templates
 *
 * Maneja el almacenamiento y recuperación de templates de checklists
 * en localStorage. Permite guardar, listar y eliminar templates.
 */

'use client';

import { useState, useEffect } from 'react';
import { STORAGE_KEYS, CHECKLIST_LIMITS } from '../constants';
import type { ChecklistTemplate, Checklist } from '../types';

/**
 * Hook para gestionar templates de checklists
 *
 * @returns Estado y funciones para templates
 */
export function useChecklistTemplates() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Carga templates desde localStorage
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTemplates(parsed);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Guarda un checklist como template
   *
   * @param name - Nombre del template
   * @param checklist - Checklist a guardar
   */
  const saveTemplate = (name: string, checklist: Checklist): void => {
    try {
      // Verificar límite de templates
      if (templates.length >= CHECKLIST_LIMITS.MAX_SAVED_TEMPLATES) {
        throw new Error(`Máximo ${CHECKLIST_LIMITS.MAX_SAVED_TEMPLATES} templates permitidos`);
      }

      const newTemplate: ChecklistTemplate = {
        id: crypto.randomUUID(),
        name,
        checklist: {
          ...checklist,
          isTemplate: true,
        },
        usageCount: 0,
        updatedAt: new Date(),
      };

      const updated = [...templates, newTemplate];
      setTemplates(updated);
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  };

  /**
   * Elimina un template
   *
   * @param templateId - ID del template a eliminar
   */
  const deleteTemplate = (templateId: string): void => {
    try {
      const updated = templates.filter((t) => t.id !== templateId);
      setTemplates(updated);
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  };

  /**
   * Incrementa el contador de uso de un template
   *
   * @param templateId - ID del template
   */
  const incrementUsage = (templateId: string): void => {
    try {
      const updated = templates.map((t) =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t
      );
      setTemplates(updated);
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(updated));
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  /**
   * Obtiene un template por ID
   *
   * @param templateId - ID del template
   * @returns Template o undefined si no existe
   */
  const getTemplate = (templateId: string): ChecklistTemplate | undefined => {
    return templates.find((t) => t.id === templateId);
  };

  return {
    templates,
    isLoading,
    saveTemplate,
    deleteTemplate,
    incrementUsage,
    getTemplate,
  };
}
