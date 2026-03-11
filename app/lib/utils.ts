/**
 * @file utils.ts
 * @module app/lib/utils
 *
 * ============================================================
 * UTILIDADES GENERALES — HELPERS DE CLASES CSS
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone la función utilitaria `cn()` para composición segura de clases
 *   CSS de Tailwind. Es el único helper de propósito general de la aplicación
 *   que no pertenece a un dominio específico (no es de IA, no es de voz, etc.).
 *
 * POR QUÉ EXISTE `cn()` (y no usar template literals directamente):
 *   Tailwind genera clases por nombre completo en tiempo de compilación.
 *   Cuando se concatenan clases condicionalmente con template literals o
 *   concatenación de strings, surgen dos problemas:
 *
 *   PROBLEMA 1 — Clases condicionales sin manejo de falsy:
 *   ```typescript
 *   // Malo: si isActive es false, el string incluye "false" como clase
 *   className={`btn ${isActive && 'btn-active'}`}
 *   ```
 *
 *   PROBLEMA 2 — Conflictos de clases Tailwind:
 *   ```typescript
 *   // Malo: ambas clases se incluyen, pero Tailwind aplica la última que
 *   // aparece en su CSS generado (que puede no ser la última en el string)
 *   className="p-4 p-8"   // ¿Cuál padding gana?
 *   ```
 *
 *   `cn()` resuelve ambos:
 *   - `clsx` maneja condicionalmente arrays, objetos y valores falsy.
 *   - `twMerge` resuelve conflictos de utilidades Tailwind del mismo tipo
 *     (la última clase del mismo grupo siempre gana, de forma predecible).
 *
 * CONVENCIÓN EN EL PROYECTO:
 *   Todos los componentes de GIMA usan `cn()` para sus `className`.
 *   Nunca se concatenan clases Tailwind directamente con template literals
 *   en los componentes de la UI.
 *
 * DÓNDE SE USA:
 *   Prácticamente en todos los componentes React de app/components/.
 *   Es el módulo más importado del proyecto después de React.
 * ============================================================
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases CSS de Tailwind de forma segura, resolviendo conflictos.
 *
 * QUÉ HACE:
 *   1. `clsx(...inputs)`: aplana y filtra la lista de inputs, aceptando strings,
 *      arrays, objetos `{ clase: condición }` y valores falsy (false, null, undefined).
 *   2. `twMerge(resultado)`: resuelve conflictos entre utilidades Tailwind del mismo
 *      grupo. La última clase de cada grupo de utilidades tiene prioridad.
 *
 * CASOS DE USO COMUNES:
 * ```typescript
 * // Clases condicionales con objeto
 * cn('btn', { 'btn-active': isActive, 'btn-disabled': isDisabled })
 * // → 'btn btn-active' (si isActive=true, isDisabled=false)
 *
 * // Resolución de conflictos Tailwind
 * cn('p-4', 'p-8')
 * // → 'p-8'  (twMerge elige la última del grupo padding)
 *
 * // Override de estilos de componente base desde el padre
 * cn('text-sm text-gray-500', props.className)
 * // → props.className puede sobreescribir text-sm o text-gray-500
 *
 * // Mezcla de condicionales y strings
 * cn('base-class', isLoading && 'opacity-50', error ? 'text-red-500' : 'text-green-500')
 * ```
 *
 * @param inputs - Cualquier combinación de strings, arrays, objetos de condición o valores falsy.
 * @returns String de clases CSS listo para usar en el atributo `className` de React.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
