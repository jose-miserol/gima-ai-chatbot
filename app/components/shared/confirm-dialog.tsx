'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { cn } from '@/app/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  loading?: boolean;
}

/**
 * Componente de diálogo de confirmación accesible
 *
 * Reemplaza el window.confirm() nativo con un diálogo accesible adecuado
 * que soporta navegación por teclado y lectores de pantalla.
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.title
 * @param root0.description
 * @param root0.confirmLabel
 * @param root0.cancelLabel
 * @param root0.onConfirm
 * @param root0.variant
 * @param root0.loading
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Eliminar elemento"
 *   description="¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer."
 *   confirmLabel="Eliminar"
 *   variant="destructive"
 *   onConfirm={() => handleDelete()}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-md font-medium transition-colors',
              'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600',
              'text-gray-700 dark:text-gray-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-md font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
            aria-label={confirmLabel}
            autoFocus
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook para gestionar el estado de ConfirmDialog
 * @example
 * ```tsx
 * const confirmDelete = useConfirmDialog();
 *
 * <button onClick={() => confirmDelete.open()}>Eliminar</button>
 *
 * <ConfirmDialog
 *   {...confirmDelete.props}
 *   title="Eliminar elemento"
 *   description="¿Está seguro?"
 *   onConfirm={() => handleDelete()}
 * />
 * ```
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    props: {
      open,
      onOpenChange: setOpen,
    },
  };
}
