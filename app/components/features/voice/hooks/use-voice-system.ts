'use client';

import { useTheme } from 'next-themes';
import { useCallback } from 'react';
import type { VoiceSystemCommand } from '@/app/types/voice-commands';
import { logger } from '@/app/lib/logger';

export function useVoiceSystem() {
  const { setTheme, theme } = useTheme();

  const executeSystem = useCallback(
    (command: VoiceSystemCommand) => {
      if (command.action === 'theme_mode') {
        // Si no hay theme definido (system), asumir light o dark based system query?
        // next-themes maneja esto, pero toggling desde 'system' es tricky.
        // Asumiremos toggle explicito entre light y dark.
        const current = theme === 'system' ? 'light' : theme;
        const newTheme = current === 'dark' ? 'light' : 'dark';

        setTheme(newTheme);
        logger.info('Theme toggled via voice command', { from: theme, to: newTheme });
        return {
          success: true,
          message: `Tema cambiado a ${newTheme === 'dark' ? 'oscuro' : 'claro'}`,
        };
      }

      if (command.action === 'logout') {
        // Mock logout
        logger.info('Logout requested via voice command');
        return { success: true, message: 'Sesión cerrada (Simulado)' };
      }

      return { success: false, message: 'Acción de sistema no soportada' };
    },
    [setTheme, theme]
  );

  return { executeSystem };
}
