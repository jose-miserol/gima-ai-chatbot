'use client';

import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface SummaryResultCardProps {
    summary: {
        title: string;
        executive: string;
        sections: Array<{
            title: string;
            content: string;
            order?: number;
        }>;
        metadata?: {
            wordCount?: number;
            readingTime?: number;
        };
    };
    cached?: boolean;
}

export function SummaryResultCard({ summary, cached }: SummaryResultCardProps) {
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

    const toggleSection = (index: number) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    return (
        <div className="rounded-lg border border-border overflow-hidden my-2">
            <div className="px-4 py-3 bg-teal-50 dark:bg-teal-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-teal-500" />
                    <span className="text-sm font-semibold">{summary.title}</span>
                </div>
                <div className="flex items-center gap-2">
                    {summary.metadata?.readingTime && (
                        <span className="text-xs text-muted-foreground">
                            ~{summary.metadata.readingTime} min lectura
                        </span>
                    )}
                    {cached && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            Caché
                        </span>
                    )}
                </div>
            </div>

            {/* Executive Summary */}
            <div className="px-4 py-3 border-b border-border/50 bg-muted/10">
                <p className="text-xs text-muted-foreground font-medium mb-1">Resumen Ejecutivo</p>
                <p className="text-sm">{summary.executive}</p>
            </div>

            {/* Sections */}
            {summary.sections.map((section, i) => (
                <div key={i} className="border-b border-border/50 last:border-b-0">
                    <button
                        onClick={() => toggleSection(i)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/20 transition-colors text-left"
                    >
                        <span className="text-xs font-medium">{section.title}</span>
                        {expandedSections.has(i) ? (
                            <ChevronUp className="size-3.5 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                        )}
                    </button>
                    {expandedSections.has(i) && (
                        <div className="px-4 pb-3">
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {section.content}
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default SummaryResultCard;
