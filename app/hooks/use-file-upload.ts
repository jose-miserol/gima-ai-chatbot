/**
 * useFileUpload Hook
 *
 * Reusable hook for handling file upload functionality.
 * Delegates validation to pure lib/validation functions.
 *
 * **Why this exists:**
 * Provides React state management for file uploads while keeping validation logic
 * in pure, testable functions. Complies with RULES.md section 1.2 (Hooks < 100L).
 *
 * @param options Configuration options for file upload
 * @returns File upload state and handlers
 */

'use client';

import { useState, useCallback, useRef } from 'react';

import { useToast } from '@/app/hooks/use-toast';
import { validateFile, bytesToMB } from '@/app/lib/validation/file-validation';

interface UseFileUploadOptions {
  maxSizeMB: number;
  acceptedTypes: string[];
  onFileSelect?: (file: File) => void;
}

interface UseFileUploadReturn {
  selectedFile: File | null;
  preview: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleReset: () => void;
}

export function useFileUpload({
  maxSizeMB,
  acceptedTypes,
  onFileSelect,
}: UseFileUploadOptions): UseFileUploadReturn {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');

  const selectFile = useCallback(
    (file: File) => {
      // Validate using pure function
      const validation = validateFile(file, { acceptedTypes, maxSizeMB });

      if (!validation.valid) {
        toast({
          title: '❌ Error de validación',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: '✅ Archivo cargado',
        description: `${file.name} (${bytesToMB(file.size)}MB)`,
      });

      onFileSelect?.(file);
    },
    [acceptedTypes, maxSizeMB, toast, onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) selectFile(file);
    },
    [selectFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) selectFile(file);
    },
    [selectFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
