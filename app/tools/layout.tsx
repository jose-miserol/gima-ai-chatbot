/**
 * @file layout.tsx
 * @module app/tools
 *
 * ============================================================
 * LAYOUT DE HERRAMIENTAS (TOOLS) — ESTRUCTURA DE PANTALLA MASTER
 * ============================================================
 *
 * QUÉ HACE:
 * Define la matriz visual (skeleton) para todas las integraciones de
 * Inteligencia Artificial bajo el endpoint raíz de `/tools`.
 *
 * CONTEXTO EN GIMA:
 * A diferencia del ChatBot nativo (`/`), la directiva de Herramientas
 * utiliza un diseño "SaaS" estándar: Un Sidebar global lateral a la 
 * izquierda, y el área contenedora para el Dashboard a la derecha.
 *
 * CÓMO FUNCIONA:
 * - Envuelve toda la jerarquía hija de rutas bajo el `SidebarProvider`.
 * - Renderiza el `Sidebar` estático en modo flex container.
 * - Inyecta dinámicamente el contenido hijo en un marco estricto (`bg-muted/10`).
 */

import { SidebarProvider } from '@/app/components/features/ai-tools/sidebar-context';
import { Sidebar } from '@/app/components/features/ai-tools/sidebar';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
    // Block access in production
    // if (process.env.NODE_ENV === 'production') {
    // notFound();
    // }

    return (
        <SidebarProvider>
            <div className="flex h-screen bg-background text-foreground overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto bg-muted/10">
                    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
                        {children}
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
