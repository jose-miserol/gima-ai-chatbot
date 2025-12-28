'use client';

import { nanoid } from 'nanoid';
import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/app/lib/logger';

import type { DataSnapshot } from '../types';


const STORAGE_KEY = 'gima_data_snapshots_v1';
const MAX_SNAPSHOTS = 10;

/**
 * Hook para gestionar el historial de snapshots de datos.
 * Permite guardar puntos de restauración y recuperar estados previos.
 * Sigue el mismo patrón que useChecklistTemplates y useCloseoutHistory.
 */
export function useDataSnapshots() {
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar historial al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSnapshots(JSON.parse(stored));
      }
    } catch (error) {
      logger.error(
        'Error loading snapshots',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar en storage
  const saveToStorage = useCallback((data: DataSnapshot[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logger.error(
        'Error saving snapshots',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }, []);

  /**
   * Crea y guarda un nuevo snapshot
   */
  const createSnapshot = useCallback(
    (data: unknown, name?: string) => {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const hash = btoa(dataString.slice(0, 50)).slice(0, 16);

      const newSnapshot: DataSnapshot = {
        id: nanoid(),
        timestamp: Date.now(),
        originalData: dataString,
        hash,
        name: name || `Version ${new Date().toLocaleTimeString()}`,
      };

      let updated = [newSnapshot, ...snapshots];
      if (updated.length > MAX_SNAPSHOTS) {
        updated = updated.slice(0, MAX_SNAPSHOTS);
      }

      setSnapshots(updated);
      saveToStorage(updated);
      logger.info('Snapshot created', { id: newSnapshot.id });
    },
    [snapshots, saveToStorage]
  );

  /**
   * Restaura un snapshot por ID
   */
  const restoreSnapshot = useCallback(
    (id: string): DataSnapshot | undefined => {
      return snapshots.find((s) => s.id === id);
    },
    [snapshots]
  );

  /**
   * Elimina un snapshot
   */
  const deleteSnapshot = useCallback(
    (id: string) => {
      const updated = snapshots.filter((s) => s.id !== id);
      setSnapshots(updated);
      saveToStorage(updated);
    },
    [snapshots, saveToStorage]
  );

  /**
   * Limpia todo el historial
   */
  const clearHistory = useCallback(() => {
    setSnapshots([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    snapshots,
    isLoading,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    clearHistory,
  };
}
