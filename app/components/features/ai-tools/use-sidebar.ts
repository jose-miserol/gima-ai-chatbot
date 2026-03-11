/**
 * @file use-sidebar.ts
 * @module app/components/features/ai-tools
 *
 * ============================================================
 * HOOK PERSONALIZADO DE SIDEBAR — CONSUMIDOR DEL CONTEXTO
 * ============================================================
 *
 * QUÉ HACE:
 * Facilita el consumo del `sidebarContext` para cualquier componente
 * que necesite leer o modificar el estado de la barra lateral.
 *
 * CONTEXTO EN GIMA:
 * Sigue el patrón estándar de React "Custom Context Hooks", evitando que
 * los componentes importen manualmente el `useContext` y el contexto mismo.
 *
 * CÓMO FUNCIONA:
 * - Extrae explícitamente los valores del contexto local.
 * - Lanza un error amigable en tiempo de desarrollo si es instanciado
 *   fuera del `SidebarProvider` padre.
 */

import { useContext } from 'react';
import { sidebarContext } from './sidebar-context';

export const useSidebar = () => {
  const context = useContext(sidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
