'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { logger } from '@/app/lib/logger';
import type { VoiceNavigationCommand } from '@/app/types/voice-commands';

/**
 *
 */
export function useVoiceNavigation() {
  const router = useRouter();

  const navigate = useCallback(
    (command: VoiceNavigationCommand) => {
      let path = command.path;

      if (!path && command.screen) {
        // Mapping logic
        const screen = command.screen.toLowerCase();

        // Home / Dashboard
        if (['home', 'inicio', 'dashboard', 'chat', 'monitor'].some((s) => screen.includes(s))) {
          path = '/';
        }
        // Tools Home
        else if (
          ['tools', 'herramientas', 'utilidades', 'aplicaciones'].some((s) => screen.includes(s))
        ) {
          path = '/tools';
        }
        // Specific Tools
        else if (['checklist', 'lista', 'creador', 'plantilla'].some((s) => screen.includes(s))) {
          path = '/tools/checklist-builder';
        } else if (
          ['summary', 'summaries', 'resumen', 'reporte', 'actividad', 'historial'].some((s) =>
            screen.includes(s)
          )
        ) {
          path = '/tools/activity-summaries';
        } else if (['closeout', 'cierre', 'nota', 'modal'].some((s) => screen.includes(s))) {
          // Work Order Closeout is just a modal in /tools normally, but let's send to tools
          path = '/tools';
        }
        // Settings (Future)
        else if (['setting', 'configuracion', 'ajuste'].some((s) => screen.includes(s))) {
          path = '/settings'; // Assuming it exists or will handle 404 gracefully
        } else {
          // Default fallback if unknown screen
          logger.warn('Unknown screen requested via voice', { screen });
          return { success: false, message: `Pantalla no encontrada: ${command.screen}` };
        }
      }

      if (path) {
        logger.info('Navigating via voice command', { path, originalScreen: command.screen });
        router.push(path);
        return { success: true, message: `Navegando a ${command.screen || 'destino'}` };
      }

      return { success: false, message: 'No se pudo determinar la ruta' };
    },
    [router]
  );

  return { navigate };
}
