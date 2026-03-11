/**
 * @file sidebar.tsx
 * @module app/components/features/ai-tools
 *
 * ============================================================
 * COMPONENTE SIDEBAR (BARRA LATERAL) — MENÚ PRINCIPAL HERRAMIENTAS IA
 * ============================================================
 *
 * QUÉ HACE:
 * Renderiza la barra lateral de navegación para la sección de
 * Herramientas de Inteligencia Artificial.
 *
 * CONTEXTO EN GIMA:
 * Este menú reemplaza la navegación global en la vista de `/tools`,
 * aislando la experiencia del usuario hacia las herramientas IA.
 * Utiliza el estilo visual establecido en el dashboard de GIMA.
 *
 * CÓMO FUNCIONA:
 * - Se integra con `sidebarContext` para gestionar su estado abierto/cerrado.
 * - Muestra un menú estático de herramientas agrupado lógicamente.
 * - Detecta automáticamente la ruta activa (`pathname`).
 *
 * @see sidebar-context.tsx Para el proveedor del estado de la barra.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    CheckCircle2,
    FileText,
    Zap,
    ImageIcon,
    Menu,
    ChevronLeft
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useSidebar } from './use-sidebar';

export function Sidebar() {
    const { isSidebarOpen, toggleSidebar } = useSidebar();
    const pathname = usePathname();
    const router = useRouter();

    // Menu Options adapted for the AI Tools section
    const menuItems: {
        group: string;
        items: {
            icon: any;
            label: string;
            href: string;
            disabled?: boolean;
        }[];
    }[] = [
            {
                group: 'Principal',
                items: [
                    {
                        icon: LayoutDashboard,
                        label: 'Dashboard IA',
                        href: '/tools',
                    },
                ]
            },
            {
                group: 'Herramientas de IA',
                items: [
                    {
                        icon: CheckCircle2,
                        label: 'Generador Checklists',
                        href: '/tools/checklist-builder',
                    },
                    {
                        icon: FileText,
                        label: 'Resúmenes Actividad',
                        href: '/tools/activity-summaries',
                    },
                    {
                        icon: Zap,
                        label: 'Transformar Datos',
                        href: '/tools/data-transformation',
                    },
                    {
                        icon: ImageIcon,
                        label: 'Análisis Imágenes',
                        href: '/tools/image-upload-test',
                    },
                    {
                        icon: FileText,
                        label: 'Análisis PDF',
                        href: '/tools/pdf-upload-test',
                    },
                ]
            }
        ];

    const handleReturnToApp = () => {
        // Navigates back to the main app dashboard (if exists) or just the chat root
        router.push('/');
    };

    return (
        <aside
            className={cn(
                "bg-[#001F3F] text-white flex flex-col h-screen sticky top-0 shadow-2xl z-50",
                "transition-all duration-300 ease-in-out shrink-0 rounded-r-3xl border-r border-white/5",
                isSidebarOpen ? "w-64" : "w-20"
            )}
        >
            {/* Header: Logo + Toggle */}
            <div className="flex items-center justify-between p-4 mb-2">
                <div
                    className={cn(
                        "relative h-10 transition-all duration-300 overflow-hidden",
                        isSidebarOpen ? "w-32 opacity-100" : "w-0 opacity-0"
                    )}
                >
                    <Link href="/" className="absolute inset-0">
                        {/* Using the existing logotype.svg */}
                        <Image
                            src="/logotype.svg"
                            alt="GIMA Logo"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </Link>
                </div>

                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white flex-shrink-0"
                    title="Alternar Menú"
                >
                    <Menu size={24} />
                </button>
            </div>

            {/* Navegación */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                <nav className="px-3 space-y-6 pb-4">
                    {menuItems.map((group, groupIdx) => (
                        <div key={groupIdx} className="space-y-2">
                            <div
                                className={cn(
                                    "px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider transition-all duration-300",
                                    !isSidebarOpen && "opacity-0 h-0 overflow-hidden"
                                )}
                            >
                                {group.group}
                            </div>

                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    // Detect active state
                                    const isActive =
                                        item.href === '/tools'
                                            ? pathname === '/tools'
                                            : pathname === item.href || pathname.startsWith(`${item.href}/`);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.disabled ? '#' : item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group overflow-hidden whitespace-nowrap",
                                                !isSidebarOpen && "justify-center",
                                                item.disabled && "opacity-50 cursor-not-allowed",
                                                isActive
                                                    ? "bg-white text-[#001F3F] font-semibold shadow-md"
                                                    : "text-gray-400 font-medium hover:text-white hover:bg-white/10"
                                            )}
                                            aria-disabled={item.disabled}
                                            tabIndex={item.disabled ? -1 : 0}
                                            onClick={(e) => {
                                                if (item.disabled) e.preventDefault();
                                            }}
                                            title={!isSidebarOpen ? item.label : undefined}
                                        >
                                            <div className="min-w-6">
                                                <Icon size={20} className={cn(isActive && "animate-pulse-once")} />
                                            </div>

                                            <span
                                                className={cn(
                                                    "transition-all duration-300 origin-left",
                                                    isSidebarOpen ? "opacity-100 translate-x-0 w-auto" : "opacity-0 -translate-x-4 w-0 hidden"
                                                )}
                                            >
                                                {item.label}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* Footer: Return */}
            <div className="p-4 border-t border-white/10 mt-auto overflow-hidden shrink-0">
                <button
                    onClick={handleReturnToApp}
                    className={cn(
                        "flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 text-gray-400 font-medium hover:text-white hover:bg-white/10 whitespace-nowrap",
                        !isSidebarOpen && "justify-center"
                    )}
                    title="Volver a GIMA"
                >
                    <div className="min-w-6">
                        <ChevronLeft size={20} />
                    </div>
                    <span
                        className={cn(
                            "transition-all duration-300",
                            isSidebarOpen ? "opacity-100" : "opacity-0 w-0 hidden"
                        )}
                    >
                        Volver a GIMA CHATBOT
                    </span>
                </button>
            </div>
        </aside>
    );
}
