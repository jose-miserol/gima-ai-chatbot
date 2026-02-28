/**
 * AIHistoryList - Lista de generaciones previas
 *
 * Muestra historial de contenido generado con búsqueda, filtros y bulk actions.
 */

'use client';

import { Clock, Trash2, Search, Star, StarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { cn } from '@/app/lib/utils';

import type { ReactNode } from 'react';

/** Número de items por página */
const ITEMS_PER_PAGE = 10;

/**
 * Item de historial genérico
 */
export interface HistoryItem {
  /** ID único */
  id: string;
  /** Título o nombre */
  title: string;
  /** Timestamp de creación */
  createdAt: Date;
  /** Veces que se ha usado */
  usageCount?: number;
  /** Preview del contenido */
  preview?: string;
  /** Si está marcado como favorito */
  isFavorite?: boolean;
  /** Metadata adicional */
  metadata?: Record<string, any>;
  /** Contenido completo original para restaurarlo al hacer clic */
  fullData?: any;
}

/**
 * Props para AIHistoryList
 */
export interface AIHistoryListProps<T extends HistoryItem = HistoryItem> {
  /** Items del historial */
  items: T[];
  /** Función para renderizar cada item (opcional) */
  renderItem?: (item: T) => ReactNode;
  /** Callback al click en item */
  onItemClick?: (item: T) => void;
  /** Callback al eliminar item */
  onItemDelete?: (item: T) => void;
  /** Callback al eliminar múltiples items */
  onBulkDelete?: (items: T[]) => void;
  /** Callback al toggle favorito */
  onToggleFavorite?: (item: T) => void;
  /** Estado vacío personalizado */
  emptyState?: ReactNode;
  /** Título de la lista */
  title?: string;
  /** Mostrar búsqueda */
  showSearch?: boolean;
  /** Mostrar filtros */
  showFilters?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Lista de historial de generaciones
 *
 * Features:
 * - Búsqueda client-side por título y preview
 * - Filtros por fecha (hoy, semana, mes, todos)
 * - Bulk delete con selección múltiple
 * - Toggle favoritos
 * - Paginación
 * @param root0
 * @param root0.items
 * @param root0.renderItem
 * @param root0.onItemClick
 * @param root0.onItemDelete
 * @param root0.onBulkDelete
 * @param root0.onToggleFavorite
 * @param root0.emptyState
 * @param root0.title
 * @param root0.showSearch
 * @param root0.showFilters
 * @param root0.className
 */
export function AIHistoryList<T extends HistoryItem = HistoryItem>({
  items,
  renderItem,
  onItemClick,
  onItemDelete,
  onBulkDelete,
  onToggleFavorite,
  emptyState,
  title = 'Historial',
  showSearch = true,
  showFilters = true,
  className,
}: AIHistoryListProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Filtrar items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.preview?.toLowerCase().includes(query)
      );
    }

    // Filtro por fecha
    const now = new Date();
    if (dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      result = result.filter((item) => new Date(item.createdAt) >= startOfDay);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter((item) => new Date(item.createdAt) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter((item) => new Date(item.createdAt) >= monthAgo);
    }

    // Ordenar: favoritos primero, luego por fecha
    result.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [items, searchQuery, dateFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((item) => item.id)));
    }
  };

  const handleBulkDelete = () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    onBulkDelete(selectedItems);
    setSelectedIds(new Set());
  };

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
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">{filteredItems.length} items</Badge>
        </div>

        {/* Search & Filters */}
        {(showSearch || showFilters) && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            {showSearch && (
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            )}
            {showFilters && (
              <Select
                value={dateFilter}
                onValueChange={(value: 'all' | 'today' | 'week' | 'month') => {
                  setDateFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {onBulkDelete && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-lg">
            <span className="text-sm">{selectedIds.size} seleccionados</span>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Select All */}
        {onBulkDelete && paginatedItems.length > 0 && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b">
            <Checkbox
              checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-xs text-muted-foreground">Seleccionar todos</span>
          </div>
        )}

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No se encontraron resultados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  onItemClick && 'cursor-pointer hover:bg-accent',
                  selectedIds.has(item.id) && 'bg-accent'
                )}
                onClick={() => onItemClick?.(item)}
              >
                {onBulkDelete && (
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                <div className="flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">{item.title}</h4>
                        {item.isFavorite && (
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        )}
                        {item.usageCount !== undefined && item.usageCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {item.usageCount}x
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
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {onToggleFavorite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item);
                      }}
                    >
                      {item.isFavorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                  {onItemDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemDelete(item);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
