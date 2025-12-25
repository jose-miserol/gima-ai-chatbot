'use client';

import { Clock, RotateCcw, Trash2, X } from 'lucide-react';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import type { DataSnapshot } from './types';

interface DataHistoryViewProps {
  snapshots: DataSnapshot[];
  onRestore: (snapshot: DataSnapshot) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Panel lateral para mostrar y gestionar el historial de snapshots.
 */
export function DataHistoryView({
  snapshots,
  onRestore,
  onDelete,
  onClear,
  isOpen,
  onClose,
}: DataHistoryViewProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col animate-in slide-in-from-right">
      <div className="p-4 border-b flex items-center justify-between bg-muted/40">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" /> Historial
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Clock className="h-8 w-8 opacity-20" />
            <p>Sin historial reciente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots
              .slice()
              .reverse()
              .map((snap) => (
                <div
                  key={snap.id}
                  className="group border rounded-md p-3 space-y-2 bg-card hover:bg-accent/30 transition-colors relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm truncate w-40" title={snap.name}>
                      {snap.name || 'Sin nombre'}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded">
                      {new Date(snap.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <Badge variant="outline" className="text-[10px] font-mono h-5">
                      {snap.originalData.length} chars
                    </Badge>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onRestore(snap)}
                        title="Restaurar versión"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(snap.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>

      {snapshots.length > 0 && (
        <div className="p-4 border-t bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:border-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Borrar todo
          </Button>
        </div>
      )}
    </div>
  );
}
