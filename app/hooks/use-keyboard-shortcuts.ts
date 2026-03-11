/**
 * @file use-keyboard-shortcuts.ts
 * @module app/hooks/use-keyboard-shortcuts
 *
 * ============================================================
 * HOOK — ATAJOS DE TECLADO DECLARATIVOS
 * ============================================================
 *
 * QUÉ HACE ESTE HOOK:
 *   Registra y gestiona atajos de teclado globales (a nivel de `window`)
 *   de forma declarativa. El componente describe qué atajos quiere manejar
 *   y el hook se encarga del ciclo de vida completo: registro, verificación
 *   de modificadores y limpieza automática al desmontar.
 *
 * POR QUÉ "GLOBAL" (window) Y NO LOCAL (elemento específico):
 *   Los atajos de GIMA son de la aplicación completa, no de un input puntual.
 *   Por ejemplo, Ctrl+M para el micrófono debe funcionar aunque el foco
 *   esté en cualquier parte de la interfaz.
 *   Si el atajo fuera local, el usuario tendría que hacer clic primero en
 *   el área correcta antes de presionar la tecla.
 *
 * COINCIDENCIA DE MODIFICADORES:
 *   Cada modificador (ctrlKey, shiftKey, altKey) se verifica contra el evento
 *   del teclado. Si el shortcut no especifica un modificador (undefined), se
 *   considera que no importa si está presionado o no.
 *   Ejemplo:
 *   - `{ key: 'k', ctrlKey: true }` → solo Ctrl+K
 *   - `{ key: 'k' }` → K con o sin modificadores (no recomendado para atajos)
 *
 * PERFORMANCE:
 *   El array `shortcuts` en las dependencias del useEffect puede causar
 *   re-registros frecuentes si se define inline en el componente.
 *   RECOMENDACIÓN: definir el array con `useMemo` en el componente padre
 *   para evitar re-crear el listener en cada render.
 *
 * DÓNDE SE USA:
 *   - ChatInput: Ctrl+M para activar/desactivar micrófono
 *   - ChatContainer: Esc para cancelar streaming, Ctrl+L para limpiar chat
 * ============================================================
 */

'use client';

import { useEffect } from 'react';

// ============================================================
// INTERFACES
// ============================================================

/**
 * Definición de un atajo de teclado individual.
 *
 * @example
 * ```typescript
 * const shortcuts: KeyboardShortcut[] =[
 *   {
 *     key: 'm',
 *     ctrlKey: true,
 *     handler: toggleMicrophone,
 *     description: 'Activar/desactivar micrófono',
 *   },
 *   {
 *     key: 'Escape',
 *     handler: cancelStreaming,
 *     description: 'Cancelar respuesta de IA en curso',
 *   },
 * ];
 * ```
 */
interface KeyboardShortcut {
  /** Tecla principal. Usar los valores de KeyboardEvent.key: 'a'-'z', 'Escape', 'Enter', 'F1', etc. */
  key: string;
  /** true si se requiere Ctrl (⌘ en Mac). undefined = no importa si está presionado. */
  ctrlKey?: boolean;
  /** true si se requiere Shift. undefined = no importa. */
  shiftKey?: boolean;
  /** true si se requiere Alt (⌥ en Mac). undefined = no importa. */
  altKey?: boolean;
  /** Función a ejecutar cuando se detecta el atajo. */
  handler: () => void;
  /** Descripción legible del atajo (para tooltips o panel de ayuda "¿Qué puedes hacer?"). */
  description: string;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Registra atajos de teclado globales de forma declarativa con limpieza automática.
 *
 * QUÉ HACE:
 *   Añade un listener `keydown` a `window` que verifica cada tecla presionada
 *   contra la lista de atajos. Al encontrar coincidencia, llama a preventDefault()
 *   para evitar el comportamiento nativo del navegador y ejecuta el handler.
 *   El listener se elimina automáticamente cuando el componente se desmonta o
 *   cuando `enabled` cambia a false.
 *
 * POR QUÉ `break` AL ENCONTRAR COINCIDENCIA:
 *   Un atajo puede coincidir con múltiples entradas si la lista está mal definida.
 *   El `break` garantiza que solo se ejecute el primer handler coincidente,
 *   evitando efectos dobles inesperados.
 *
 * POR QUÉ COMPARACIÓN CASE-INSENSITIVE (.toLowerCase()):
 *   Con Caps Lock activado, `event.key` retorna 'M' en lugar de 'm'.
 *   La comparación insensible a mayúsculas garantiza que el atajo funcione
 *   independientemente del estado de Caps Lock.
 *
 * @param shortcuts - Lista de atajos a registrar. Usar `useMemo` en el componente padre.
 * @param enabled   - Si false, el listener no se registra. Útil para deshabilitar
 *                    atajos durante modales, inputs de texto activos, etc.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    // Si enabled es false, no registrar el listener en absoluto.
    // Ejemplo de uso: deshabilitar atajos mientras un modal de confirmación está abierto.
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        // Verificar cada modificador: si el shortcut lo especifica, debe coincidir.
        // Si es `undefined`, se acepta cualquier valor (presente o ausente).
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === event.ctrlKey;
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey;
        const altMatch = shortcut.altKey === undefined || shortcut.altKey === event.altKey;

        // FIX: Comprobamos que event.key exista antes de hacer toLowerCase()
        // para evitar errores por autocompletado del navegador u orígenes anómalos.
        // Comparación insensible a mayúsculas para ignorar el estado de Caps Lock.
        const keyMatch = !!event.key && shortcut.key.toLowerCase() === event.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault(); // Evitar comportamiento nativo (ej: Ctrl+K no abre barra de URL)
          shortcut.handler();
          break; // Solo ejecutar el primer atajo coincidente
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup: eliminar el listener cuando el componente se desmonta o
    // cuando `shortcuts` o `enabled` cambian (useEffect lo re-registra limpio).
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
