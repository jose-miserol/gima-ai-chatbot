'use client';

import { CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from '../tool-result-cards';

interface ChecklistResultCardProps {
    checklist: {
        title: string;
        description?: string;
        items: Array<{
            id: string;
            description: string;
            category?: string;
            required?: boolean;
            notes?: string;
        }>;
    };
    cached?: boolean;
}

/**
 * Formats checklist items as plain text for clipboard
 */
function formatChecklistAsText(checklist: ChecklistResultCardProps['checklist']): string {
    let text = `📋 ${checklist.title}\n`;
    if (checklist.description) text += `${checklist.description}\n`;
    text += '\n';
    checklist.items.forEach((item, i) => {
        const required = item.required ? ' *' : '';
        const category = item.category ? ` [${item.category}]` : '';
        text += `${i + 1}. ${item.description}${required}${category}\n`;
        if (item.notes) text += `   → ${item.notes}\n`;
    });
    return text;
}

export function ChecklistResultCard({ checklist, cached }: ChecklistResultCardProps) {
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    const requiredCount = checklist.items.filter(i => i.required).length;
    const optionalCount = checklist.items.length - requiredCount;

    const toggleItem = (id: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    return (
        <div className="rounded-lg border border-border overflow-hidden my-2">
            {/* Header */}
            <div className="px-4 py-3 bg-green-50 dark:bg-green-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span className="text-sm font-semibold">{checklist.title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                        {checkedItems.size}/{checklist.items.length} completados
                    </span>
                    {cached && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            Desde caché
                        </span>
                    )}
                    <CopyButton
                        text={formatChecklistAsText(checklist)}
                        label="Copiar"
                    />
                </div>
            </div>

            {/* Description + item counts */}
            {(checklist.description || requiredCount > 0) && (
                <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
                    {checklist.description && (
                        <p className="text-xs text-muted-foreground">{checklist.description}</p>
                    )}
                    {requiredCount > 0 && (
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-red-500 font-medium">{requiredCount} obligatorios</span>
                            {optionalCount > 0 && (
                                <span className="text-muted-foreground">{optionalCount} opcionales</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Items with interactive checkboxes */}
            <div className="p-4 space-y-2">
                {checklist.items.map((item, i) => {
                    const itemId = item.id || `item-${i}`;
                    const isChecked = checkedItems.has(itemId);

                    return (
                        <div key={itemId} className={`flex items-start gap-2 ${isChecked ? 'opacity-60' : ''}`}>
                            <button
                                onClick={() => toggleItem(itemId)}
                                className={`mt-0.5 size-4 rounded border flex items-center justify-center text-xs shrink-0 transition-colors
                                    ${isChecked
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'border-border hover:border-green-400'
                                    }`}
                                aria-label={`Marcar "${item.description}" como ${isChecked ? 'incompleto' : 'completado'}`}
                            >
                                {isChecked ? '✓' : i + 1}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs ${isChecked ? 'line-through' : ''}`}>
                                    {item.description}
                                    {item.required && (
                                        <span className="ml-1 text-red-500 text-[10px]">*</span>
                                    )}
                                </p>
                                {item.notes && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.notes}</p>
                                )}
                            </div>
                            {item.category && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                    {item.category}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ChecklistResultCard;
