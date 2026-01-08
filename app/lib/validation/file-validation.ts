/**
 * File Validation Utilities
 *
 * Pure functions for validating file uploads.
 * No dependencies on React or UI frameworks - can be used in Server Actions,
 * Client Components, or anywhere file validation is needed.
 *
 * **Why this exists:**
 * Extracted from useFileUpload hook to comply with RULES.md section 1.2 (Hooks < 100L).
 * Follows separation of concerns: pure logic in lib/, React hooks in hooks/.
 *
 * @module file-validation
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file type against accepted types
 *
 * @param file File to validate
 * @param acceptedTypes Array of accepted MIME types
 * @returns Validation result with error message if invalid
 */
export function validateFileType(file: File, acceptedTypes: string[]): FileValidationResult {
  if (!acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de archivo no válido. Solo se aceptan: ${acceptedTypes.join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * Validates file size against maximum allowed size
 *
 * @param file File to validate
 * @param maxSizeMB Maximum size in megabytes
 * @returns Validation result with error message if invalid
 */
export function validateFileSize(file: File, maxSizeMB: number): FileValidationResult {
  const sizeMB = file.size / (1024 * 1024);

  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `Archivo demasiado grande (${sizeMB.toFixed(1)}MB). Máximo: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validates file against all criteria
 *
 * @param file File to validate
 * @param options Validation options
 * @returns Combined validation result
 */
export function validateFile(
  file: File,
  options: {
    acceptedTypes: string[];
    maxSizeMB: number;
  }
): FileValidationResult {
  // Validate type first
  const typeResult = validateFileType(file, options.acceptedTypes);
  if (!typeResult.valid) {
    return typeResult;
  }

  // Then validate size
  const sizeResult = validateFileSize(file, options.maxSizeMB);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true };
}

/**
 * Converts file size in bytes to megabytes
 *
 * @param bytes File size in bytes
 * @returns Size in MB with 2 decimal places
 */
export function bytesToMB(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}
