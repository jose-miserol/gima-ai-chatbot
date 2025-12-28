'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** Intervalo de auto-guardado en ms (30 segundos) */
const AUTO_SAVE_INTERVAL = 30000;

/** Key prefix para localStorage */
const DRAFT_KEY_PREFIX = 'ai-form-draft-';

/**
 * Hook para manejar drafts en localStorage
 * @param draftId - ID único del borrador
 * @param enabled - Si el guardado está habilitado
 * @param initialData - Datos iniciales
 */
export function useDraft<T>(
  draftId: string | undefined,
  enabled: boolean,
  initialData: T
): {
  data: T;
  setData: (data: T) => void;
  isDirty: boolean;
  lastSaved: Date | null;
  save: () => void;
  clear: () => void;
} {
  const key = draftId ? `${DRAFT_KEY_PREFIX}${draftId}` : null;
  const [data, setDataInternal] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const initialRef = useRef(initialData);

  // Cargar draft al montar
  useEffect(() => {
    if (!enabled || !key) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDataInternal(parsed.data);
        setLastSaved(new Date(parsed.savedAt));
      }
    } catch {
      // Ignorar errores de parsing
    }
  }, [enabled, key]);

  const setData = useCallback((newData: T) => {
    setDataInternal(newData);
    setIsDirty(JSON.stringify(newData) !== JSON.stringify(initialRef.current));
  }, []);

  const save = useCallback(() => {
    if (!enabled || !key) return;

    try {
      localStorage.setItem(
        key,
        JSON.stringify({ data, savedAt: new Date().toISOString() })
      );
      setLastSaved(new Date());
    } catch {
      // Ignorar errores de storage
    }
  }, [enabled, key, data]);

  const clear = useCallback(() => {
    if (!key) return;

    try {
      localStorage.removeItem(key);
      setDataInternal(initialRef.current);
      setIsDirty(false);
      setLastSaved(null);
    } catch {
      // Ignorar errores
    }
  }, [key]);

  // Auto-save cada 30 segundos si hay cambios
  useEffect(() => {
    if (!enabled || !isDirty) return;

    const timer = setInterval(save, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [enabled, isDirty, save]);

  // Advertir al salir con cambios sin guardar
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return { data, setData, isDirty, lastSaved, save, clear };
}
