/**
 * ChatQuickActions — Botones de acción rápida para el chat
 *
 * Chips interactivos que aparecen en el empty state del chat.
 * Al hacer click, inyectan un prompt predefinido:
 * - Prompts completos se envían automáticamente
 * - Prompts con `formFields` muestran un formulario inline de validación
 * - Prompts abiertos (terminan en espacio, sin formFields) enfocan el input
 *
 * Incluye:
 * - QuickActionDataForm: Formulario inline liviano (patrón OrderApprovalCard)
 * - ToolsDropdown: Dropdown de herramientas para el input area
 */

'use client';

import {
    Package, ClipboardList, AlertTriangle, Wrench, FileText, PlusCircle,
    Sparkles, Send, X,
} from 'lucide-react';
import { type ReactNode, useState, useRef, useEffect, useCallback } from 'react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

import type { FormField } from '@/app/components/features/ai-tools/shared/types';

// ===========================================
// Quick Action Definitions
// ===========================================

export interface QuickAction {
    icon: ReactNode;
    label: string;
    prompt: string;
    colorClass: string;
    /** Campos del formulario para acciones que requieren datos */
    formFields?: FormField[];
    /** Construye el prompt final a partir de los datos del formulario */
    promptBuilder?: (data: Record<string, unknown>) => string;
}

export const QUICK_ACTIONS: QuickAction[] = [
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
        formFields: [
            {
                name: 'equipmentName',
                label: 'Nombre del equipo',
                type: 'text',
                placeholder: 'Ej: Compresor de aire Atlas Copco',
                required: true,
                minLength: 3,
            },
        ],
        promptBuilder: (data) =>
            `Genera un checklist de mantenimiento preventivo para ${String(data.equipmentName).trim()}`,
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
        formFields: [
            {
                name: 'activityNotes',
                label: 'Notas de actividad',
                type: 'textarea',
                placeholder: 'Pega aquí las notas de actividad que deseas resumir...',
                required: true,
                minLength: 10,
                rows: 4,
            },
        ],
        promptBuilder: (data) =>
            `Necesito resumir estas notas de actividad:\n\n${String(data.activityNotes).trim()}`,
    },
    {
        icon: <PlusCircle className="size-3.5" />,
        label: 'Crear Orden',
        prompt: 'Crear una orden de trabajo para ',
        colorClass: 'hover:border-red-400/50 hover:bg-red-50 dark:hover:bg-red-950/20',
        formFields: [
            {
                name: 'equipment',
                label: 'Equipo',
                type: 'text',
                placeholder: 'Ej: Bomba centrífuga P-101',
                required: true,
                minLength: 3,
            },
            {
                name: 'description',
                label: 'Descripción del trabajo',
                type: 'textarea',
                placeholder: 'Describe el trabajo a realizar...',
                required: true,
                minLength: 10,
                rows: 3,
            },
            {
                name: 'priority',
                label: 'Prioridad',
                type: 'select',
                required: true,
                defaultValue: 'media',
                options: [
                    { value: 'baja', label: 'Baja' },
                    { value: 'media', label: 'Media' },
                    { value: 'alta', label: 'Alta' },
                ],
            },
        ],
        promptBuilder: (data) =>
            `Crear una orden de trabajo para ${String(data.equipment).trim()} con prioridad ${data.priority}. Descripción: ${String(data.description).trim()}`,
    },
];

// ===========================================
// QuickActionDataForm — Formulario inline
// ===========================================

interface QuickActionDataFormProps {
    action: QuickAction;
    onSubmit: (composedPrompt: string) => void;
    onCancel: () => void;
}

/**
 * QuickActionDataForm — Formulario inline liviano para acciones con datos
 *
 * Sigue el patrón visual de OrderApprovalCard:
 * - Header con icono + label de la acción
 * - Campos dinámicos desde formFields
 * - Botones Enviar / Cancelar
 *
 * Features:
 * - Auto-focus en el primer campo al montar
 * - Esc para cancelar
 * - Sanitización (trim) de inputs antes de enviar
 * - aria-live para accesibilidad
 */
export function QuickActionDataForm({ action, onSubmit, onCancel }: QuickActionDataFormProps) {
    const fields = action.formFields || [];

    // Estado local del formulario
    const [formData, setFormData] = useState<Record<string, unknown>>(() => {
        const initial: Record<string, unknown> = {};
        fields.forEach((field) => {
            initial[field.name] = field.defaultValue ?? '';
        });
        return initial;
    });

    const formRef = useRef<HTMLFormElement>(null);
    const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

    // Auto-focus primer campo al montar
    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    // Esc para cancelar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const handleChange = useCallback((name: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Sanitizar: trim a todos los string values
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(formData)) {
            sanitized[key] = typeof value === 'string' ? value.trim() : value;
        }

        // Componer prompt con el promptBuilder de la acción
        const composedPrompt = action.promptBuilder
            ? action.promptBuilder(sanitized)
            : action.prompt + Object.values(sanitized).join(' ');

        onSubmit(composedPrompt);
    };

    return (
        <div
            className="animate-in slide-in-from-bottom-3 fade-in duration-200
                        rounded-lg border-2 border-primary/30 overflow-hidden my-2"
            aria-live="polite"
        >
            {/* Header */}
            <div className="px-4 py-3 bg-primary/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-primary">{action.icon}</span>
                    <span className="text-sm font-semibold">{action.label}</span>
                </div>
                <button
                    onClick={onCancel}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Cancelar formulario"
                >
                    <X className="size-4" />
                </button>
            </div>

            {/* Form */}
            <form ref={formRef} onSubmit={handleSubmit} className="p-4 space-y-3">
                {fields.map((field, index) => (
                    <div key={field.name} className="space-y-1.5">
                        <label htmlFor={`qa-${field.name}`} className="text-xs font-medium">
                            {field.label}
                            {field.required && <span className="text-destructive ml-0.5">*</span>}
                        </label>

                        {/* Text input */}
                        {field.type === 'text' && (
                            <input
                                ref={index === 0 ? (firstInputRef as React.RefObject<HTMLInputElement>) : undefined}
                                id={`qa-${field.name}`}
                                type="text"
                                placeholder={field.placeholder}
                                value={(formData[field.name] as string) || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                required={field.required}
                                minLength={field.minLength}
                                maxLength={field.maxLength}
                                className="w-full px-3 py-2 text-sm rounded-md border border-border
                                           bg-background placeholder:text-muted-foreground
                                           focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        )}

                        {/* Textarea */}
                        {field.type === 'textarea' && (
                            <textarea
                                ref={index === 0 ? (firstInputRef as React.RefObject<HTMLTextAreaElement>) : undefined}
                                id={`qa-${field.name}`}
                                placeholder={field.placeholder}
                                value={(formData[field.name] as string) || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                required={field.required}
                                minLength={field.minLength}
                                maxLength={field.maxLength}
                                rows={field.rows || 3}
                                className="w-full px-3 py-2 text-sm rounded-md border border-border
                                           bg-background placeholder:text-muted-foreground resize-none
                                           focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        )}

                        {/* Select */}
                        {field.type === 'select' && field.options && (
                            <select
                                ref={index === 0 ? (firstInputRef as React.RefObject<HTMLSelectElement>) : undefined}
                                id={`qa-${field.name}`}
                                value={(formData[field.name] as string) || ''}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                required={field.required}
                                className="w-full px-3 py-2 text-sm rounded-md border border-border
                                           bg-background
                                           focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="" disabled>
                                    {field.placeholder || 'Seleccionar...'}
                                </option>
                                {field.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Help text */}
                        {field.helpText && (
                            <p className="text-[10px] text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                ))}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        type="submit"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                                   bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Send className="size-3.5" />
                        Enviar
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                                   bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
}

// ===========================================
// ChatQuickActions — Chips de acción rápida
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

// ===========================================
// Tools Dropdown (for input area — always visible)
// ===========================================

interface ToolsDropdownProps {
    onActionClick: (prompt: string) => void;
    disabled?: boolean;
}

/**
 * ToolsDropdown — Botón con dropdown de herramientas para el input area
 *
 * Siempre visible junto al botón de voz y adjuntos.
 * Al seleccionar una acción, cierra el dropdown e inyecta el prompt.
 */
export function ToolsDropdown({ onActionClick, disabled }: ToolsDropdownProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <button
                    className="inline-flex items-center justify-center size-8 rounded-md
                     text-muted-foreground hover:text-foreground hover:bg-muted
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Herramientas de IA"
                >
                    <Sparkles className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel className="text-xs">Herramientas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUICK_ACTIONS.map((action) => (
                    <DropdownMenuItem
                        key={action.label}
                        onClick={() => onActionClick(action.prompt)}
                        className="gap-2 cursor-pointer"
                    >
                        {action.icon}
                        <span>{action.label}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
