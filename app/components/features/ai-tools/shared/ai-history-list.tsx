/**
 * AIHistoryList - Lista de generaciones previas
 *
 * Muestra historial de contenido generado con opciones de reutilización.
 */

'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Clock, Trash2 } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import type { ReactNode } from 'react';

/**
 * Item de historial genérico
 */
export interface HistoryItem {
  /**
   * ID único
   */
  id: string;

  /**
   * Título o nombre
   */
  title: string;

  /**
   * Timestamp de creación
   */
  createdAt: Date;

  /**
   * Veces que se ha usado
   */
  usageCount?: number;

  /**
   * Preview del contenido
   */
  preview?: string;

  /**
   * Metadata adicional
   */
  metadata?: Record<string, unknown>;
}

/**
 * Props para AIHistoryList
 */
export interface AIHistoryListProps<T extends HistoryItem = HistoryItem> {
  /**
   * Items del historial
   */
  items: T[];

  /**
   * Función para renderizar cada item (opcional)
   */
  renderItem?: (item: T) => ReactNode;

  /**
   * Callback al click en item
   */
  onItemClick?: (item: T) => void;

  /**
   * Callback al eliminar item
   */
  onItemDelete?: (item: T) => void;

  /**
   * Estado vacío personalizado
   */
  emptyState?: ReactNode;

  /**
   * Título de la lista
   */
  title?: string;

  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Lista de historial de generaciones
 */
export function AIHistoryList<T extends HistoryItem = HistoryItem>({
  items,
  renderItem,
  onItemClick,
  onItemDelete,
  emptyState,
  title = 'Historial',
  className,
}: AIHistoryListProps<T>) {
  // Empty state
  if (items.length === 0) {
    if (emptyState) {
      return <div className={className}>{emptyState}</div>;
    }

    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay elementos en el historial</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{title}</h3>}

      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className={cn('transition-colors', onItemClick && 'cursor-pointer hover:bg-accent')}
            onClick={() => onItemClick?.(item)}
          >
            <CardContent className="p-4">
              {renderItem ? (
                renderItem(item)
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">{item.title}</h4>
                      {item.usageCount !== undefined && item.usageCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {item.usageCount}x usado
                        </Badge>
                      )}
                    </div>

                    {item.preview && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.preview}</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {new Date(item.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {onItemDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemDelete(item);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
