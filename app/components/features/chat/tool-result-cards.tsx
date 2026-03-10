/**
 * Tool Result Cards — Componentes de Generative UI para resultados de tools
 *
 * Renderiza los resultados de las chat tools como componentes React
 * en lugar de texto plano o JSON. Cada tool tiene su card especializada.
 *
 * Componentes:
 * - ToolLoadingCard: Skeleton mientras la tool ejecuta
 * - ToolErrorCard: Error con sugerencia
 * - DataResultCard: Tabla con columnas específicas por tool y badges de estado
 * - OrderApprovalCard: Preview de orden con botones Aprobar/Rechazar
 * - ChecklistResultCard: Checklist generado
 * - SummaryResultCard: Resumen de actividades
 */

'use client';

import {
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

// ===========================================
// Loading Card
// ===========================================

interface ToolLoadingCardProps {
    toolName: string;
}

// FIX: Eliminada la entrada 'tool-consultar_activos_por_categoria' — la tool no existe en chat-tools.ts.
const TOOL_LABELS: Record<string, string> = {
    'tool-consultar_activos': 'Buscando activos...',
    'tool-consultar_mantenimientos': 'Consultando mantenimientos...',
    'tool-consultar_calendario': 'Cargando calendario...',
    'tool-consultar_reportes': 'Consultando reportes...',
    'tool-consultar_inventario': 'Buscando en inventario...',
    'tool-consultar_proveedores': 'Cargando proveedores...',
    'tool-generar_checklist': 'Generando checklist con IA...',
    'tool-generar_resumen_actividad': 'Generando resumen con IA...',
    'tool-crear_orden_trabajo': 'Preparando orden de trabajo...',
};

export function ToolLoadingCard({ toolName }: ToolLoadingCardProps) {
    const label = TOOL_LABELS[toolName] || 'Procesando...';

    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border animate-pulse">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    );
}

// ===========================================
// Error Card
// ===========================================

interface ToolErrorCardProps {
    error: string;
    suggestion?: string;
}

export function ToolErrorCard({ error, suggestion }: ToolErrorCardProps) {
    // Log raw error to console for debugging
    if (typeof window !== 'undefined') {
        console.error('[GIMA Chat Error]:', error);
    }

    const isContextError =
        error?.includes('Failed to call a function') ||
        error?.includes('failed_generation') ||
        error === 'Error en la herramienta' ||
        error === 'Error desconocido';

    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <AlertCircle className="size-4 text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0" />
            <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {isContextError ? 'El modelo no pudo analizar el contexto.' : error}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    {suggestion || (isContextError ? 'Si esto continúa, recargue la página.' : 'Intente de nuevo o consulte al administrador.')}
                </p>
            </div>
        </div>
    );
}

// ===========================================
// Status & Priority Badges
// ===========================================

const STATUS_COLORS: Record<string, string> = {
    operativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    disponible: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    en_mantenimiento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    mantenimiento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    en_progreso: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    fuera_servicio: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    fuera_de_servicio: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    inactivo: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
    alta: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    critica: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    media: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    baja: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

function StatusBadge({ value }: { value: string }) {
    const normalized = value.toLowerCase().replace(/\s+/g, '_');
    const colorClass = STATUS_COLORS[normalized] || 'bg-muted text-muted-foreground';
    const label = value.replace(/_/g, ' ');
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${colorClass}`}>
            {label}
        </span>
    );
}

function PriorityBadge({ value }: { value: string }) {
    const normalized = value.toLowerCase().replace(/\s+/g, '_');
    const colorClass = PRIORITY_COLORS[normalized] || 'bg-muted text-muted-foreground';
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${colorClass}`}>
            {value}
        </span>
    );
}

function StockIndicator({ stock, stockMin }: { stock: number; stockMin?: number }) {
    const isCritical = stockMin !== undefined && stock <= stockMin;
    const isWarning = stockMin !== undefined && stock <= stockMin * 1.5;
    const colorClass = isCritical
        ? 'text-red-600 dark:text-red-400 font-semibold'
        : isWarning
            ? 'text-yellow-600 dark:text-yellow-400 font-medium'
            : 'text-foreground';
    return (
        <span className={colorClass}>
            {stock.toLocaleString('es-VE')}
            {stockMin !== undefined && (
                <span className="text-muted-foreground font-normal">/{stockMin}</span>
            )}
        </span>
    );
}

// ===========================================
// Tool-Specific Column Definitions
// ===========================================

interface ColumnDef {
    key: string;
    label: string;
    render?: (value: unknown, item: Record<string, unknown>) => ReactNode;
}

/**
 * Devuelve las columnas optimizadas para cada tool.
 * FIX: Eliminado el case 'tool-consultar_activos_por_categoria' — la tool no existe.
 */
function getToolColumns(toolName: string, items: Record<string, unknown>[]): ColumnDef[] {
    switch (toolName) {
        case 'tool-consultar_activos':
            return [
                { key: 'id', label: 'ID' },
                {
                    key: 'nombre', label: 'Descripción',
                    render: (_, item) => {
                        const articulo = item.articulo as Record<string, unknown> | undefined;
                        return articulo?.descripcion
                            ? String(articulo.descripcion)
                            : (articulo?.modelo ? String(articulo.modelo) : '—');
                    }
                },
                {
                    key: 'estado', label: 'Estado',
                    render: (v) => v ? <StatusBadge value={String(v)} /> : '—',
                },
                {
                    key: 'tipo', label: 'Tipo',
                    render: (_, item) => {
                        const articulo = item.articulo as Record<string, unknown> | undefined;
                        return articulo?.tipo ? String(articulo.tipo) : '—';
                    }
                },
                {
                    key: 'sede', label: 'Ubicación',
                    render: (_, item) => {
                        const ubic = item.ubicacion as Record<string, unknown> | undefined;
                        if (!ubic) return '—';
                        const partes = [ubic.edificio, ubic.salon].filter(Boolean);
                        return partes.length > 0 ? partes.join(' - ') : '—';
                    }
                },
            ];

        case 'tool-consultar_inventario':
            return [
                { key: 'codigo', label: 'Código' },
                { key: 'descripcion', label: 'Repuesto' },
                {
                    key: 'stock', label: 'Stock',
                    render: (v, item) => typeof v === 'number'
                        ? <StockIndicator stock={v} stockMin={typeof item.stock_minimo === 'number' ? item.stock_minimo : undefined} />
                        : formatCellValue(v),
                },
                { key: 'stock_minimo', label: 'Mín.' },
                { key: 'costo', label: 'Costo' },
            ];

        case 'tool-consultar_mantenimientos':
            return [
                { key: 'id', label: 'ID' },
                { key: 'descripcion', label: 'Descripción' },
                { key: 'tipo', label: 'Tipo' },
                {
                    key: 'prioridad', label: 'Prioridad',
                    render: (_, item) => {
                        const reporte = item.reporte as Record<string, unknown> | undefined;
                        return reporte?.prioridad ? <PriorityBadge value={String(reporte.prioridad)} /> : '—';
                    }
                },
                {
                    key: 'estado', label: 'Estado',
                    render: (v) => v ? <StatusBadge value={String(v)} /> : '—',
                },
            ];

        case 'tool-consultar_proveedores':
            return [
                { key: 'nombre', label: 'Proveedor' },
                { key: 'contacto', label: 'Contacto' },
                { key: 'email', label: 'Email' },
                { key: 'telefono', label: 'Teléfono' },
            ];

        case 'tool-consultar_reportes':
            return [
                { key: 'id', label: 'ID' },
                {
                    key: 'activo', label: 'Activo',
                    render: (_, item) => {
                        const activo = item.activo as Record<string, unknown> | undefined;
                        const articulo = activo?.articulo as Record<string, unknown> | undefined;
                        return articulo?.descripcion
                            ? String(articulo.descripcion)
                            : (articulo?.modelo ? String(articulo.modelo) : '—');
                    }
                },
                {
                    key: 'prioridad', label: 'Prioridad',
                    render: (v) => v ? <PriorityBadge value={String(v)} /> : '—',
                },
                {
                    key: 'estado', label: 'Estado',
                    render: (v) => v ? <StatusBadge value={String(v)} /> : '—',
                },
                { key: 'descripcion', label: 'Descripción' },
            ];

        case 'tool-consultar_calendario':
            return [
                {
                    key: 'fecha_programada', label: 'Fecha',
                    render: (v) => v ? formatCellValue(v) : '—',
                },
                {
                    key: 'activo', label: 'Activo',
                    render: (_, item) => {
                        const activo = item.activo as Record<string, unknown> | undefined;
                        const articulo = activo?.articulo as Record<string, unknown> | undefined;
                        return articulo?.descripcion
                            ? String(articulo.descripcion)
                            : (articulo?.modelo ? String(articulo.modelo) : '—');
                    }
                },
                { key: 'tipo', label: 'Tipo' },
                {
                    key: 'estado', label: 'Estado',
                    render: (v) => v ? <StatusBadge value={String(v)} /> : '—',
                },
            ];

        default:
            return getGenericColumns(items);
    }
}

/**
 * Fallback: auto-detect columns from data.
 */
function getGenericColumns(items: Record<string, unknown>[]): ColumnDef[] {
    if (items.length === 0) return [];
    const first = items[0];
    const allKeys = Object.keys(first);

    const priority = [
        'id', 'nombre', 'descripcion', 'estado', 'tipo', 'codigo',
        'marca', 'modelo', 'stock', 'stock_minimo', 'costo', 'prioridad',
        'fecha_apertura', 'fecha_programada', 'sede', 'edificio',
        'contacto', 'email', 'telefono', 'valor',
    ];

    const sorted = allKeys
        .filter(key => {
            const val = first[key];
            return (
                typeof val !== 'object' &&
                !Array.isArray(val) &&
                !key.endsWith('_id') &&
                key !== 'created_at' &&
                key !== 'updated_at'
            );
        })
        .sort((a, b) => {
            const aIdx = priority.indexOf(a);
            const bIdx = priority.indexOf(b);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        })
        .slice(0, 5);

    return sorted.map(key => ({
        key,
        label: formatColumnHeader(key),
    }));
}

// ===========================================
// Data Result Card
// ===========================================

interface DataResultCardProps {
    data: {
        items: Record<string, unknown>[];
        pagination: {
            page: number;
            lastPage: number;
            total: number;
            hasMore: boolean;
        };
    };
    toolName: string;
    summary?: string;
}

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') return value.toLocaleString('es-VE');
    return String(value);
}

function formatColumnHeader(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export function DataResultCard({ data, toolName, summary }: DataResultCardProps) {
    const [expanded, setExpanded] = useState(true);
    const columns = getToolColumns(toolName, data.items);

    const toolLabel = toolName.replace('tool-', '').replace(/_/g, ' ');

    if (data.items.length === 0) {
        return (
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">No se encontraron resultados</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border overflow-hidden my-2" role="region" aria-label={`Resultados de ${toolLabel}`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span className="text-sm font-medium capitalize">{toolLabel}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {data.pagination.total} resultado{data.pagination.total !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {data.pagination.lastPage > 1 && (
                        <span className="text-xs text-muted-foreground">
                            Pág. {data.pagination.page}/{data.pagination.lastPage}
                        </span>
                    )}
                    {expanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Table */}
            {expanded && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table" aria-label={`Tabla de ${toolLabel}`}>
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {columns.map(col => (
                                    <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, i) => (
                                <tr key={i} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                                    {columns.map(col => (
                                        <td key={col.key} className="px-3 py-2 text-xs">
                                            {col.render
                                                ? col.render(item[col.key], item)
                                                : formatCellValue(item[col.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Summary */}
            {summary && (
                <div className="px-3 py-2 border-t border-border/50 bg-muted/10">
                    <p className="text-xs text-muted-foreground">{summary}</p>
                </div>
            )}
        </div>
    );
}

// ===========================================
// Order Approval Card (needsApproval)
// ===========================================

interface OrderApprovalCardProps {
    input: {
        equipment?: string;
        description?: string;
        priority?: string;
        location?: string;
    };
    onApprove: () => void;
    onDeny: () => void;
}

export function OrderApprovalCard({ input, onApprove, onDeny }: OrderApprovalCardProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleApprove = () => {
        setIsSubmitting(true);
        onApprove();
    };

    const handleDeny = () => {
        setIsSubmitting(true);
        onDeny();
    };

    return (
        <div className="rounded-lg border-2 border-amber-300 dark:border-amber-600 overflow-hidden my-2">
            {/* Header */}
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Confirmación requerida
                </span>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <p className="text-sm font-medium">Crear orden de trabajo:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {input.equipment && (
                        <>
                            <span className="text-muted-foreground">Equipo:</span>
                            <span className="font-medium">{input.equipment}</span>
                        </>
                    )}
                    {input.description && (
                        <>
                            <span className="text-muted-foreground">Descripción:</span>
                            <span className="font-medium">{input.description}</span>
                        </>
                    )}
                    {input.priority && (
                        <>
                            <span className="text-muted-foreground">Prioridad:</span>
                            <span className="font-medium">
                                <PriorityBadge value={input.priority} />
                            </span>
                        </>
                    )}
                    {input.location && (
                        <>
                            <span className="text-muted-foreground">Ubicación:</span>
                            <span className="font-medium">{input.location}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-3 border-t border-border bg-muted/10">
                <button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                     bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSubmitting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <CheckCircle className="size-3.5" />
                    )}
                    {isSubmitting ? 'Procesando...' : 'Aprobar y Crear'}
                </button>
                <button
                    onClick={handleDeny}
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                     bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <XCircle className="size-3.5" />
                    Cancelar
                </button>
            </div>
        </div>
    );
}

// ===========================================
// Copy Button (reusable)
// ===========================================

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback silently
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                       text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={label}
        >
            {copied ? (
                <>
                    <Check className="size-3 text-green-500" />
                    <span className="text-green-500">Copiado</span>
                </>
            ) : (
                <>
                    <Copy className="size-3" />
                    <span>{label}</span>
                </>
            )}
        </button>
    );
}
