'use client';

import { AIGenerationForm } from '../ai-tools/shared/ai-generation-form';
import { ALLOWED_OPERATIONS } from './constants';
import type { TransformationRequest } from './types';

/**
 * Props para DataTransformationForm
 */
interface DataTransformationFormProps {
  /** Función a ejecutar al enviar el formulario */
  onSubmit: (data: TransformationRequest) => void;
  /** Indica si se está procesando una solicitud */
  isProcessing: boolean;
  /** Datos iniciales para pre-llenar (ej. al restaurar snapshot) */
  initialSourceData?: string;
}

/**
 * Formulario para Data Transformation
 *
 * Reutiliza AIGenerationForm para proporcionar inputs de datos y texto.
 * Configurado específicamente para manejar instrucciones de transformación y datos crudos.
 */
export function DataTransformationForm({
  onSubmit,
  isProcessing,
  initialSourceData,
}: DataTransformationFormProps) {
  return (
    <AIGenerationForm
      title="Transformación de Datos"
      description="Ingresa tus datos y describe cómo quieres transformarlos. Usaré IA para procesar tu solicitud."
      submitLabel="Analizar y Previsualizar"
      isGenerating={isProcessing}
      fields={[
        {
          name: 'sourceData',
          label: 'Datos de Origen',
          type: 'textarea',
          placeholder:
            'Pega aquí tus datos (CSV, JSON, Texto logs...)\nMáximo 50KB para esta demo.',
          required: true,
          maxLength: 50000,
          rows: 12,
          defaultValue: initialSourceData,
        },
        {
          name: 'instruction',
          label: 'Instrucción',
          type: 'textarea',
          placeholder: 'Ej: Limpia los emails inválidos y ordena por fecha descendente...',
          required: true,
          rows: 3,
          helpText: `Operaciones soportadas: ${ALLOWED_OPERATIONS.join(', ')}`,
        },
        {
          name: 'format',
          label: 'Formato de Entrada (Opcional)',
          type: 'select',
          options: [
            { label: 'Auto-detectar', value: 'auto' },
            { label: 'JSON', value: 'json' },
            { label: 'CSV', value: 'csv' },
            { label: 'Texto', value: 'text' },
          ],
          defaultValue: 'auto',
        },
      ]}
      onSubmit={(data) => onSubmit(data as unknown as TransformationRequest)}
    />
  );
}
