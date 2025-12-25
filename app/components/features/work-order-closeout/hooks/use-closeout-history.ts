/**
 * useCloseoutHistory - Hook para gestionar historial de notas de cierre
 *
 * Hook personalizado para guardar, cargar y gestionar
 * historial de notas en localStorage.
 */

'use client';

import { useState, useEffect } from 'react';
import { STORAGE_KEYS, CLOSEOUT_LIMITS } from '../constants';
import type { CloseoutHistory, CloseoutNotes } from '../types';

/**
 * Hook para gestionar historial de notas de cierre
 */
export function useCloseoutHistory() {
  const [history, setHistory] = useState<CloseoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Carga historial desde localStorage
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const historyWithDates = parsed.map((h: any) => ({
          ...h,
          notes: {
            ...h.notes,
            createdAt: new Date(h.notes.createdAt),
          },
          updatedAt: new Date(h.updatedAt),
        }));
        setHistory(historyWithDates);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Guarda historial en localStorage
   */
  const saveToStorage = (newHistory: CloseoutHistory[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error al guardar historial:', error);
    }
  };

  /**
   * Guarda notas en historial
   */
  const saveToHistory = (name: string, notes: CloseoutNotes) => {
    const newEntry: CloseoutHistory = {
      id: crypto.randomUUID(),
      name,
      notes,
      usageCount: 0,
      updatedAt: new Date(),
    };

    let updatedHistory = [...history, newEntry];

    // Limitar a máximo de entradas
    if (updatedHistory.length > CLOSEOUT_LIMITS.MAX_SAVED_HISTORY) {
      updatedHistory = updatedHistory.slice(-CLOSEOUT_LIMITS.MAX_SAVED_HISTORY);
    }

    setHistory(updatedHistory);
    saveToStorage(updatedHistory);
  };

  /**
   * Elimina del historial
   */
  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter((h) => h.id !== id);
    setHistory(updatedHistory);
    saveToStorage(updatedHistory);
  };

  /**
   * Incrementa contador de uso
   */
  const incrementUsage = (id: string) => {
    const updatedHistory = history.map((h) =>
      h.id === id
        ? {
            ...h,
            usageCount: h.usageCount + 1,
            updatedAt: new Date(),
          }
        : h
    );

    setHistory(updatedHistory);
    saveToStorage(updatedHistory);
  };

  /**
   * Obtiene entrada del historial
   */
  const getFromHistory = (id: string): CloseoutHistory | undefined => {
    return history.find((h) => h.id === id);
  };

  return {
    history,
    isLoading,
    saveToHistory,
    deleteFromHistory,
    incrementUsage,
    getFromHistory,
  };
}
