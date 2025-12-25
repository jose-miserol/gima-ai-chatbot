/**
 * CloseoutNotesButton - Botón para abrir modal de notas de cierre
 *
 * Componente simple que puede agregarse a cualquier página de Work Order detail.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { FileText } from 'lucide-react';
import { CloseoutNotesModal } from './closeout-notes-modal';
import type { WorkOrderSummary, CloseoutNotes } from './types';

export interface CloseoutNotesButtonProps {
  /**
   * Datos del work order
   */
  workOrderData: WorkOrderSummary;

  /**
   * Callback cuando las notas se aceptan
   */
  onNotesAccepted?: (notes: CloseoutNotes) => void;

  /**
   * Variante del botón
   */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';

  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Botón para abrir modal de generación de notas de cierre
 */
export function CloseoutNotesButton({
  workOrderData,
  onNotesAccepted,
  variant = 'default',
  className,
}: CloseoutNotesButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setIsModalOpen(true)} className={className}>
        <FileText className="h-4 w-4 mr-2" />
        Generar Notas de Cierre
      </Button>

      <CloseoutNotesModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        workOrderData={workOrderData}
        onNotesAccepted={onNotesAccepted}
      />
    </>
  );
}
