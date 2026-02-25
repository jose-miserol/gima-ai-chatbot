/**
 * ChatQuickActions — Botones de acción rápida para el chat
 *
 * Chips interactivos que aparecen en el empty state del chat.
 * Al hacer click, inyectan un prompt predefinido:
 * - Prompts completos se envían automáticamente
 * - Prompts abiertos (terminan en espacio) enfocan el input para que el usuario complete
 */

'use client';

import { Package, ClipboardList, AlertTriangle, Wrench, FileText, PlusCircle } from 'lucide-react';
import type { ReactNode } from 'react';

// ===========================================
// Quick Action Definitions
// ===========================================

interface QuickAction {
    icon: ReactNode;
    label: string;
    prompt: string;
    colorClass: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        icon: <Wrench className="size-3.5" />,
        label: 'Ver Activos',
        prompt: '¿Cuáles son los activos registrados en el sistema?',
        colorClass: 'hover:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-950/20',
    },
    {
        icon: <ClipboardList className="size-3.5" />,
        label: 'Generar Checklist',
        prompt: 'Genera un checklist de mantenimiento preventivo para ',
        colorClass: 'hover:border-green-400/50 hover:bg-green-50 dark:hover:bg-green-950/20',
    },
    {
        icon: <AlertTriangle className="size-3.5" />,
        label: 'Stock Bajo',
        prompt: '¿Qué repuestos están bajos de stock?',
        colorClass: 'hover:border-amber-400/50 hover:bg-amber-50 dark:hover:bg-amber-950/20',
    },
    {
        icon: <Package className="size-3.5" />,
        label: 'Mantenimientos',
        prompt: '¿Cuáles son los mantenimientos pendientes?',
        colorClass: 'hover:border-purple-400/50 hover:bg-purple-50 dark:hover:bg-purple-950/20',
    },
    {
        icon: <FileText className="size-3.5" />,
        label: 'Resumir Actividad',
        prompt: 'Necesito resumir estas notas de actividad: ',
        colorClass: 'hover:border-teal-400/50 hover:bg-teal-50 dark:hover:bg-teal-950/20',
    },
    {
        icon: <PlusCircle className="size-3.5" />,
        label: 'Crear Orden',
        prompt: 'Crear una orden de trabajo para ',
        colorClass: 'hover:border-red-400/50 hover:bg-red-50 dark:hover:bg-red-950/20',
    },
];

// ===========================================
// Component
// ===========================================

interface ChatQuickActionsProps {
    onActionClick: (prompt: string) => void;
    disabled?: boolean;
}

/**
 * ChatQuickActions — Botones chip de acción rápida
 *
 * @param onActionClick - Callback que recibe el prompt a inyectar
 * @param disabled - Deshabilita todos los botones
 */
export function ChatQuickActions({ onActionClick, disabled }: ChatQuickActionsProps) {
    return (
        <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
            {QUICK_ACTIONS.map((action) => (
                <button
                    key={action.label}
                    onClick={() => onActionClick(action.prompt)}
                    disabled={disabled}
                    className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
            text-xs font-medium border transition-all duration-200
            bg-background border-border
            hover:shadow-sm active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
            ${action.colorClass}
          `}
                >
                    {action.icon}
                    <span>{action.label}</span>
                </button>
            ))}
        </div>
    );
}
