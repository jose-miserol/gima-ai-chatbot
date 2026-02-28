/**
 * Tool Result Cards — Componentes de Generative UI para resultados de tools
 *
 * Renderiza los resultados de las chat tools como componentes React
 * en lugar de texto plano o JSON. Cada tool tiene su card especializada.
 *
 * Componentes:
 * - ToolLoadingCard: Skeleton mientras la tool ejecuta
 * - ToolErrorCard: Error con sugerencia
 * - DataResultCard: Tabla genérica con paginación para consultas al backend
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
} from 'lucide-react';
import { useState } from 'react';

// ===========================================
// Loading Card
// ===========================================

interface ToolLoadingCardProps {
    toolName: string;
}

const TOOL_LABELS: Record<string, string> = {
    'tool-consultar_activos': 'Buscando activos...',
    'tool-consultar_activos_por_categoria': 'Agrupando activos por categoría...',
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
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
            <div>
                <p className="text-sm text-destructive font-medium">{error}</p>
                {suggestion && (
                    <p className="text-xs text-muted-foreground mt-1">{suggestion}</p>
                )}
            </div>
        </div>
    );
}

// ===========================================
// Data Result Card (Tablas genéricas)
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

/**
 * Extrae las columnas clave de los datos para mostrar en la tabla.
 * Prioriza campos legibles y limita a 5 columnas.
 */
function getDisplayColumns(items: Record<string, unknown>[]): string[] {
    if (items.length === 0) return [];

    const first = items[0];
    const allKeys = Object.keys(first);

    // Priorizar campos legibles
    const priority = [
        'id', 'nombre', 'descripcion', 'estado', 'tipo', 'codigo',
        'marca', 'modelo', 'stock', 'stock_minimo', 'costo', 'prioridad',
        'fecha_apertura', 'fecha_programada', 'sede', 'edificio',
        'contacto', 'email', 'telefono', 'valor',
    ];

    const sorted = allKeys
        .filter(key => {
            const val = first[key];
            // Excluir relaciones (objetos), arrays, y campos internos
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
        });

    return sorted.slice(0, 5);
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
    const columns = getDisplayColumns(data.items);

    const toolLabel = toolName.replace('tool-', '').replace(/_/g, ' ');

    if (data.items.length === 0) {
        return (
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-sm text-muted-foreground">No se encontraron resultados</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border overflow-hidden my-2">
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
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/20">
                                {columns.map(col => (
                                    <th key={col} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                                        {formatColumnHeader(col)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, i) => (
                                <tr key={i} className="border-b border-border/50 hover:bg-muted/10">
                                    {columns.map(col => (
                                        <td key={col} className="px-3 py-2 text-xs">
                                            {formatCellValue(item[col])}
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
                            <span className="font-medium capitalize">{input.priority}</span>
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
                    onClick={onApprove}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                     bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                    <CheckCircle className="size-3.5" />
                    Aprobar y Crear
                </button>
                <button
                    onClick={onDeny}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium
                     bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                    <XCircle className="size-3.5" />
                    Cancelar
                </button>
            </div>
        </div>
    );
}

