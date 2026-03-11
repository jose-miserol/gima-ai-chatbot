/**
 * @file sidebar-context.tsx
 * @module app/components/features/ai-tools
 *
 * ============================================================
 * CONTEXTO DE SIDEBAR — GESTIÓN DE ESTADO DE NAVEGACIÓN
 * ============================================================
 *
 * QUÉ HACE:
 * Provee un contexto genérico de React (`sidebarContext`) para administrar
 * si el panel lateral de herramientas de IA está abierto o colapsado.
 *
 * CONTEXTO EN GIMA:
 * Sincroniza el estado del Sidebar entre el botón de alternar
 * menú en el interior del componente y el diseño general del layout.
 *
 * CÓMO FUNCIONA:
 * - Define el Provider `SidebarProvider` que envuelve el Layout de `/tools`.
 * - Gestiona un estado local reactivo `isSidebarOpen`.
 * - Expone el método `toggleSidebar` a sus consumidores hijos.
 */

'use client';

import { createContext, useState, useMemo, type ReactNode, useCallback } from 'react';

interface SidebarContextType {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
}

export const sidebarContext = createContext<SidebarContextType>({
    isSidebarOpen: false,
    toggleSidebar: () => { },
});

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen((prev) => !prev);
    }, []);

    const value = useMemo(
        () => ({
            isSidebarOpen,
            toggleSidebar,
        }),
        [isSidebarOpen, toggleSidebar]
    );

    return (
        <sidebarContext.Provider value={value}>
            {children}
        </sidebarContext.Provider>
    );
}
