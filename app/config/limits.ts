/**
 * Centralized Size Limits Configuration
 *
 * Constantes para límites de tamaño de archivos y mensajes.
 * Centralizadas para consistencia y fácil mantenimiento.
 */

// ========================================
// Server Actions & API Limits
// ========================================

/**
 * Límite de tamaño del body para Server Actions de Next.js
 * Must match next.config.ts bodySizeLimit
 */
export const SERVER_ACTION_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Límite de tamaño del body para Server Actions (en formato legible)
 */
export const SERVER_ACTION_BODY_SIZE_MB = 5;

// ========================================
// Audio Limits
// ========================================

/**
 * Tamaño máximo permitido para archivos de audio
 */
export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Tamaño máximo permitido para archivos de audio (en MB)
 */
export const MAX_AUDIO_SIZE_MB = 5;

// ========================================
// Image Limits
// ========================================

/**
 * Tamaño máximo permitido para archivos de imagen
 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Tamaño máximo permitido para archivos de imagen (en MB)
 */
export const MAX_IMAGE_SIZE_MB = 5;

// ========================================
// PDF Limits
// ========================================

/**
 * Tamaño máximo permitido para archivos PDF
 * Gemini soporta hasta 2GB probados, pero limitamos a 10MB por UX
 */
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Tamaño máximo permitido para archivos PDF (en MB)
 */
export const MAX_PDF_SIZE_MB = 10;

/**
 * Tipos MIME permitidos para documentos
 */
export const SUPPORTED_PDF_MIME_TYPES = ['application/pdf'];

// ========================================
// Message Limits
// ========================================

/**
 * Tamaño máximo permitido para el contenido de un mensaje de texto
 * 10KB es suficiente para ~5000 palabras
 */
export const MAX_MESSAGE_TEXT_BYTES = 10 * 1024; // 10KB

/**
 * Tamaño máximo permitido para el contenido de un mensaje (en KB)
 */
export const MAX_MESSAGE_TEXT_KB = 10;

// ========================================
// Chat History Limits
// ========================================

/**
 * Número máximo de mensajes a mantener en localStorage
 * Previene crecimiento indefinido de almacenamiento
 */
export const MAX_STORED_MESSAGES = 100;

// ========================================
// Helper Functions
// ========================================

/**
 * Convierte bytes a megabytes
 * @param bytes - Cantidad de bytes
 * @returns Tamaño en megabytes (redondeado a 1 decimal)
 */
export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/**
 * Convierte megabytes a bytes
 * @param mb - Cantidad de megabytes
 * @returns Tamaño en bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Verifica si un tamaño en bytes excede el límite especificado
 * @param sizeInBytes - Tamaño a verificar
 * @param limitInBytes - Límite permitido
 * @returns true si excede el límite
 */
export function exceedsLimit(sizeInBytes: number, limitInBytes: number): boolean {
  return sizeInBytes > limitInBytes;
}
