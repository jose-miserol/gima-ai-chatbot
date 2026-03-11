/**
 * @file use-file-upload.ts
 * @module app/hooks/use-file-upload
 *
 * ============================================================
 * HOOK — GESTIÓN DE CARGA DE ARCHIVOS CON DRAG & DROP
 * ============================================================
 *
 * QUÉ HACE ESTE HOOK:
 *   Encapsula toda la lógica de estado para subir archivos en la UI de GIMA:
 *   selección por clic, arrastrar y soltar (drag & drop), validación de tipo
 *   y tamaño, generación de preview base64 y notificaciones de resultado.
 *
 * POR QUÉ EXISTE (separación de responsabilidades):
 *   Los componentes que suben archivos (PDF Analyzer, Image Analyzer) tienen
 *   exactamente la misma lógica de estado pero distinta UI. Este hook
 *   centraliza ese estado para que cada componente solo maneje su presentación.
 *
 *   La validación de archivos está en `lib/validation/file-validation.ts`
 *   (función pura y testeable), no aquí. Este hook solo maneja el estado React.
 *   Esta separación sigue RULES.md §1.2: Hooks < 100 líneas.
 *
 * EVENTOS DE ENTRADA SOPORTADOS:
 *   - Input file nativo: <input type="file"> → handleFileInput
 *   - Drag and Drop: zona de drop en un div → handleDrop + handleDragOver
 *   - Reset programático: handleReset() para limpiar tras enviar el archivo
 *
 * FLUJO AL SELECCIONAR UN ARCHIVO:
 *   1. `selectFile(file)` es invocado por handleFileInput o handleDrop.
 *   2. `validateFile()` verifica tipo MIME y tamaño.
 *      - Si inválido: toast.error() + return (no actualiza estado).
 *      - Si válido: continúa.
 *   3. Se almacena el archivo en `selectedFile`.
 *   4. FileReader genera un data URL para el preview visual.
 *   5. toast.success() confirma la carga al usuario.
 *   6. `onFileSelect?(file)` notifica al componente padre.
 *
 * DÓNDE SE USA:
 *   - app/components/features/pdf-reader/PdfDropzone.tsx
 *   - app/components/features/vision/ImageDropzone.tsx
 * ============================================================
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// Hook de notificaciones toast del sistema de UI de GIMA
import { useToast } from '@/app/components/ui/toast';

// validateFile: función pura que verifica tipo MIME y tamaño sin efectos de lado
// bytesToMB: convierte bytes a MB con 1 decimal para mostrar en el toast
import { validateFile, bytesToMB } from '@/app/lib/validation/file-validation';

// ============================================================
// INTERFACES
// ============================================================

/**
 * Configuración del hook. Se pasa al instanciarlo en el componente.
 *
 * @example
 * ```typescript
 * // Para el uploader de PDFs:
 * useFileUpload({
 *   maxSizeMB: 10,
 *   acceptedTypes: ['application/pdf'],
 *   onFileSelect: (file) => setFileToAnalyze(file),
 * })
 *
 * // Para el uploader de imágenes:
 * useFileUpload({
 *   maxSizeMB: 5,
 *   acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
 * })
 * ```
 */
interface UseFileUploadOptions {
  /** Tamaño máximo permitido en MB. Debe coincidir con el límite de la Server Action correspondiente. */
  maxSizeMB: number;
  /** Array de MIME types permitidos. Ejemplo: ['application/pdf'] o ['image/jpeg', 'image/png']. */
  acceptedTypes: string[];
  /** Callback opcional invocado con el archivo seleccionado tras validación exitosa. */
  onFileSelect?: (file: File) => void;
}

/**
 * Objeto retornado por el hook con todo el estado y los handlers necesarios.
 */
interface UseFileUploadReturn {
  /** El archivo seleccionado y validado, o null si no hay archivo. */
  selectedFile: File | null;
  /** Data URL (base64) para mostrar un preview del archivo. Vacío si no hay archivo. */
  preview: string;
  /** Ref que se pasa al elemento <input type="file"> para resetear su valor. */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Handler para el evento onChange del <input type="file">. */
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handler para el evento onDrop de una zona de drop. */
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Handler para el evento onDragOver (necesario para activar el drop). */
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Limpia el archivo seleccionado, el preview y el valor del input. */
  handleReset: () => void;
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook reutilizable para gestión de carga de archivos con validación y preview.
 *
 * @param options - Configuración de tipos permitidos, tamaño máximo y callback.
 * @returns Estado del archivo seleccionado y handlers para los eventos de la UI.
 */
export function useFileUpload({
  maxSizeMB,
  acceptedTypes,
  onFileSelect,
}: UseFileUploadOptions): UseFileUploadReturn {
  const toast = useToast();

  // Ref al <input type="file"> para limpiar su valor en handleReset.
  // POR QUÉ REF Y NO STATE: El input file no tiene valor controlado en React
  // (por seguridad del navegador). La única forma de resetearlo es acceder
  // directamente al DOM y asignar fileInputRef.current.value = ''.
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');

  /**
   * Valida y procesa un archivo seleccionado por cualquier método.
   *
   * QUÉ HACE:
   *   Función central invocada tanto por handleFileInput como por handleDrop.
   *   Delega la validación a `validateFile()` (función pura) y gestiona el estado
   *   React + la generación del preview de forma independiente.
   *
   * POR QUÉ useCallback con [acceptedTypes, maxSizeMB, toast, onFileSelect]:
   *   Estas dependencias cambian si el componente padre cambia la configuración.
   *   useCallback evita recrear la función en cada render cuando no hay cambios.
   */
  const selectFile = useCallback(
    (file: File) => {
      // Delegar validación a función pura (testeable sin React)
      const validation = validateFile(file, { acceptedTypes, maxSizeMB });

      if (!validation.valid) {
        // Mostrar error específico de validación (tipo no permitido, tamaño excedido)
        toast.error('❌ Error de validación', validation.error);
        return; // No actualizar estado con un archivo inválido
      }

      setSelectedFile(file);

      // Generar preview base64 para mostrar en la UI (imagen o ícono de PDF)
      // FileReader es asíncrono; el preview se actualiza cuando `onload` dispara.
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file); // Dispara onload con el data URL completo

      // Confirmar la carga al usuario con nombre y tamaño del archivo
      toast.success('✅ Archivo cargado', `${file.name} (${bytesToMB(file.size)}MB)`);

      // Notificar al componente padre para que inicie el proceso (ej: pre-cargar la API)
      onFileSelect?.(file);
    },
    [acceptedTypes, maxSizeMB, toast, onFileSelect]
  );

  /**
   * Handler para el evento onChange del elemento <input type="file">.
   * Extrae el primer archivo seleccionado y lo pasa a selectFile().
   * El usuario puede seleccionar solo un archivo a la vez.
   */
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) selectFile(file);
    },
    [selectFile]
  );

  /**
   * Handler para el evento onDrop de la zona de arrastre.
   *
   * POR QUÉ e.preventDefault():
   *   Sin preventDefault(), el navegador intenta abrir el archivo arrastrado
   *   como una nueva URL, navegando fuera de la aplicación.
   *   Llamar a preventDefault() en `onDrop` es el estándar para zonas de drop.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); // Prevenir navegación del browser al archivo
      const file = e.dataTransfer.files[0];
      if (file) selectFile(file);
    },
    [selectFile]
  );

  /**
   * Handler para el evento onDragOver de la zona de arrastre.
   *
   * POR QUÉ EXISTE (y no hace nada más):
   *   El navegador NO dispara onDrop a menos que onDragOver llame a
   *   e.preventDefault(). Este handler existe únicamente por este motivo.
   *   Sin él, soltar el archivo no haría nada.
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necesario para habilitar el evento onDrop
  }, []);

  /**
   * Limpia completamente el estado del uploader.
   *
   * CUÁNDO LLAMARLO:
   *   - Tras enviar el archivo para análisis (evitar reenvíos accidentales).
   *   - Cuando el usuario hace clic en "Cancelar" o "Limpiar".
   *   - Antes de permitir seleccionar un nuevo archivo si ya había uno.
   *
   * POR QUÉ LIMPIAR fileInputRef.current.value:
   *   React no controla el valor de los inputs file. Si solo se limpia
   *   el estado, el input seguiría mostrando el nombre del archivo anterior.
   *   El usuario no podría volver a seleccionar el mismo archivo porque
   *   el onChange no dispararía (el valor no "cambiaría").
   */
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset del DOM para permitir re-selección del mismo archivo
    }
  }, []);

  return {
    selectedFile,
    preview,
    fileInputRef,
    handleFileInput,
    handleDrop,
    handleDragOver,
    handleReset,
  };
}
