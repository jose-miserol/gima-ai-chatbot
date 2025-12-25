/**
 * useSummaryTemplates - Hook para gestionar templates de resúmenes
 *
 * Hook personalizado para guardar, cargar y gestionar
 * templates de resúmenes en localStorage.
 */

'use client';

import { useState, useEffect } from 'react';
import { STORAGE_KEYS, SUMMARY_LIMITS } from '../constants';
import type { SummaryTemplate, ActivitySummary } from '../types';

/**
 * Hook para gestionar templates de resúmenes
 *
 * @returns Estado y funciones de gestión de templates
 */
export function useSummaryTemplates() {
  const [templates, setTemplates] = useState<SummaryTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Carga templates desde localStorage
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convertir strings de fecha a Date objects
        const templatesWithDates = parsed.map((t: any) => ({
          ...t,
          summary: {
            ...t.summary,
            createdAt: new Date(t.summary.createdAt),
          },
          updatedAt: new Date(t.updatedAt),
        }));
        setTemplates(templatesWithDates);
      }
    } catch (error) {
      console.error('Error al cargar templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Guarda templates en localStorage
   *
   * @param newTemplates - Templates a guardar
   */
  const saveToStorage = (newTemplates: SummaryTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(newTemplates));
    } catch (error) {
      console.error('Error al guardar templates:', error);
    }
  };

  /**
   * Guarda un nuevo template
   *
   * @param name - Nombre del template
   * @param summary - Resumen a guardar
   */
  const saveTemplate = (name: string, summary: ActivitySummary) => {
    const newTemplate: SummaryTemplate = {
      id: crypto.randomUUID(),
      name,
      summary,
      usageCount: 0,
      updatedAt: new Date(),
    };

    let updatedTemplates = [...templates, newTemplate];

    // Limitar a máximo de templates
    if (updatedTemplates.length > SUMMARY_LIMITS.MAX_SAVED_TEMPLATES) {
      // Remover el más antiguo
      updatedTemplates = updatedTemplates.slice(-SUMMARY_LIMITS.MAX_SAVED_TEMPLATES);
    }

    setTemplates(updatedTemplates);
    saveToStorage(updatedTemplates);
  };

  /**
   * Elimina un template
   *
   * @param id - ID del template a eliminar
   */
  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter((t) => t.id !== id);
    setTemplates(updatedTemplates);
    saveToStorage(updatedTemplates);
  };

  /**
   * Incrementa el contador de uso de un template
   *
   * @param id - ID del template
   */
  const incrementUsage = (id: string) => {
    const updatedTemplates = templates.map((t) =>
      t.id === id
        ? {
            ...t,
            usageCount: t.usageCount + 1,
            updatedAt: new Date(),
          }
        : t
    );

    setTemplates(updatedTemplates);
    saveToStorage(updatedTemplates);
  };

  /**
   * Obtiene un template por ID
   *
   * @param id - ID del template
   * @returns Template encontrado o undefined
   */
  const getTemplate = (id: string): SummaryTemplate | undefined => {
    return templates.find((t) => t.id === id);
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
