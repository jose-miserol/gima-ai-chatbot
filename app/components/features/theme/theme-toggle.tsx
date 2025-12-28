'use client';

import { Moon, Sun } from 'lucide-react';
import { useState, useCallback, useSyncExternalStore, useLayoutEffect } from 'react';

import { cn } from '@/app/lib/utils';

import { THEME_CONFIG } from './constants';

import type { Theme } from './types';

/**
 * Obtiene el tema actual de localStorage o preferencias del sistema
 * Retorna el tema por defecto para compatibilidad con SSR
 */
function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return THEME_CONFIG.defaultTheme as Theme;
  const saved = localStorage.getItem(THEME_CONFIG.storageKey) as Theme | null;
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Snapshot del servidor siempre retorna el tema por defecto para prevenir hydration mismatch
 */
function getServerSnapshot(): Theme {
  return THEME_CONFIG.defaultTheme as Theme;
}

/**
 * Suscribirse a eventos de storage para sincronización entre pestañas
 * @param callback
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

/**
 *
 * @param root0
 * @param root0.className
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const storedTheme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
  const [theme, setTheme] = useState<Theme>(storedTheme);

  // useLayoutEffect runs synchronously before browser paint
  // This prevents theme flash and avoids cascading renders
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional for SSR hydration
    setMounted(true);
    document.documentElement.classList.toggle(THEME_CONFIG.darkModeClass, storedTheme === 'dark');
  }, [storedTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(THEME_CONFIG.storageKey, newTheme);
    document.documentElement.classList.toggle(THEME_CONFIG.darkModeClass, newTheme === 'dark');
  }, [theme]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className={cn(
          'flex items-center justify-center size-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
          className
        )}
        aria-label="Cambiar tema"
        disabled
      >
        <div className="size-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'flex items-center justify-center size-9 rounded-lg border transition-all duration-200',
        'border-zinc-200 dark:border-zinc-700',
        'bg-white dark:bg-zinc-900',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'hover:border-zinc-300 dark:hover:border-zinc-600',
        'text-zinc-600 dark:text-zinc-400',
        'hover:text-zinc-900 dark:hover:text-zinc-100',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900',
        className
      )}
      aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
    >
      {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
