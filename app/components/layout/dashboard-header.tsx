/**
 * @file dashboard-header.tsx
 * @module app/components/layout
 *
 * ============================================================
 * ENCABEZADO DE DASHBOARD — TÍTULO Y SUBTOTAL CONSISTENTES
 * ============================================================
 *
 * QUÉ HACE:
 * Renderiza la sección superior blanca del panel, que contiene el título 
 * de la página actual y un subtítulo de bienvenida.
 *
 * CONTEXTO EN GIMA:
 * Fue importado y adaptado del repositorio `gima-project` para unificar
 * el aspecto visual de los encabezados entre la plataforma base de
 * gestión y el dashboard modular de las herramientas AI.
 *
 * CÓMO FUNCIONA:
 * - Toma propiedades customizadas `title` y `subtitle`.
 * - Si no se provee un `title`, usa la ruta de Next.js (`usePathname`) para
 *   intentar autogenerar un formato legible de cabecera.
 */

"use client"

import { usePathname } from "next/navigation"

interface DashboardHeaderProps {
    title?: string
    subtitle?: string
}

export function DashboardHeader({ title, subtitle = "Bienvenido al panel de IA GIMA" }: DashboardHeaderProps) {
    const pathname = usePathname()
    const pathParts = pathname.split("/").filter((part) => part)
    const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : "Dashboard"
    const autoTitle = lastPart === "tools"
        ? "Herramientas de IA"
        : lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, ' ')

    return (
        <div className="bg-white border-b border-gray-200 px-8 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{title || autoTitle}</h1>
                    <p className="text-gray-600 mt-1">{subtitle}</p>
                </div>
            </div>
        </div>
    )
}
