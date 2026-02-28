'use client';

import { CheckCircle } from 'lucide-react';

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

export function ChecklistResultCard({ checklist, cached }: ChecklistResultCardProps) {
    return (
        <div className="rounded-lg border border-border overflow-hidden my-2">
            <div className="px-4 py-3 bg-green-50 dark:bg-green-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-500" />
                    <span className="text-sm font-semibold">{checklist.title}</span>
                </div>
                {cached && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Desde caché
                    </span>
                )}
            </div>

            {checklist.description && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border/50">
                    {checklist.description}
                </p>
            )}

            <div className="p-4 space-y-2">
                {checklist.items.map((item, i) => (
                    <div key={item.id || i} className="flex items-start gap-2">
                        <div className="mt-0.5 size-4 rounded border border-border flex items-center justify-center text-xs shrink-0">
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs">
                                {item.description}
                                {item.required && (
                                    <span className="ml-1 text-red-500 text-[10px]">*obligatorio</span>
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
                ))}
            </div>
        </div>
    );
}

export default ChecklistResultCard;
