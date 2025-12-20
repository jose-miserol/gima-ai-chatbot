'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/app/lib/utils';

type Theme = 'light' | 'dark';

// External store for theme - avoids setState in useEffect
function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme') as Theme | null;
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

function subscribe(callback: () => void): () => void {
  // Listen for storage changes from other tabs
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const storedTheme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
  const [theme, setTheme] = useState<Theme>(storedTheme);

  // Track mount state
  if (typeof window !== 'undefined' && !mounted) {
    setMounted(true);
    // Apply initial theme
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }

  const toggleTheme = useCallback(() => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
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
