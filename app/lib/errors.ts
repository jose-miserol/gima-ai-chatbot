/**
 * Custom error classes for type-safe error handling across the application
 */

/**
 * Base error class for API-related errors
 * Use this for errors from external API calls (GROQ, Gemini, etc.)
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly provider: 'groq' | 'google' | 'unknown',
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }

  /**
   * Check if error is retryable based on status code
   */
  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }

  /**
   * Get user-friendly error message
   */
  get userMessage(): string {
    if (this.statusCode === 429) {
      return 'Tasa de solicitudes excedida. Por favor intenta de nuevo en un momento.';
    }
    if (this.statusCode >= 500) {
      return 'Error del servidor. Por favor intenta de nuevo más tarde.';
    }
    return this.message;
  }
}

/**
 * Error for validation failures (Zod, input validation, etc.)
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  get userMessage(): string {
    if (this.field) {
      return `Error de validación en ${this.field}: ${this.message}`;
    }
    return `Error de validación: ${this.message}`;
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number // seconds
  ) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  get userMessage(): string {
    const minutes = Math.ceil(this.retryAfter / 60);
    if (minutes > 1) {
      return `Has excedido el límite de solicitudes. Intenta nuevamente en ${minutes} minutos.`;
    }
    return `Has excedido el límite de solicitudes. Intenta nuevamente en ${this.retryAfter} segundos.`;
  }
}

/**
 * Error for storage quota issues (localStorage, etc.)
 */
export class StorageQuotaError extends Error {
  constructor(
    message: string,
    public readonly storageType: 'localStorage' | 'sessionStorage' = 'localStorage'
  ) {
    super(message);
    this.name = 'StorageQuotaError';
    Object.setPrototypeOf(this, StorageQuotaError.prototype);
  }

  get userMessage(): string {
    return 'Almacenamiento lleno. Se ha reducido el historial guardado.';
  }
}

/**
 * Type guard to check if error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Type guard to check if error is a StorageQuotaError
 */
export function isStorageQuotaError(error: unknown): error is StorageQuotaError {
  return error instanceof StorageQuotaError;
}

/**
 * Convert unknown error to a known error type
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(String(error));
}

/**
 * Error for voice command processing failures
 * Use this for errors specific to voice-activated requests
 */
export class VoiceCommandError extends Error {
  static readonly CODES = {
    PARSING_FAILED: 'VOICE_CMD_PARSING_FAILED',
    CONFIDENCE_TOO_LOW: 'VOICE_CMD_CONFIDENCE_LOW',
    RATE_LIMITED: 'VOICE_CMD_RATE_LIMITED',
    INVALID_ACTION: 'VOICE_CMD_INVALID_ACTION',
    SANITIZATION_FAILED: 'VOICE_CMD_SANITIZATION_FAILED',
  } as const;

  constructor(
    message: string,
    public readonly code: keyof typeof VoiceCommandError.CODES,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VoiceCommandError';
    Object.setPrototypeOf(this, VoiceCommandError.prototype);
  }

  get userMessage(): string {
    switch (this.code) {
      case 'CONFIDENCE_TOO_LOW':
        return 'No pude entender el comando claramente. Por favor, repite.';
      case 'RATE_LIMITED':
        return 'Has excedido el límite de comandos de voz. Intenta más tarde.';
      case 'INVALID_ACTION':
        return 'Acción no válida. Comandos disponibles: crear orden, verificar estado.';
      case 'SANITIZATION_FAILED':
        return 'Por seguridad, no puedo procesar esta entrada.';
      default:
        return this.message;
    }
  }
}

/**
 * Error for PDF processing failures
 * Use this for errors specific to PDF upload and analysis
 */
export class PDFError extends Error {
  static readonly CODES = {
    INVALID_FILE: 'PDF_INVALID_FILE',
    TOO_LARGE: 'PDF_TOO_LARGE',
    TOO_MANY_PAGES: 'PDF_TOO_MANY_PAGES',
    EXTRACTION_FAILED: 'PDF_EXTRACTION_FAILED',
    CORRUPTED: 'PDF_CORRUPTED',
    ANALYSIS_FAILED: 'PDF_ANALYSIS_FAILED',
  } as const;

  constructor(
    message: string,
    public readonly code: keyof typeof PDFError.CODES,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PDFError';
    Object.setPrototypeOf(this, PDFError.prototype);
  }

  get userMessage(): string {
    switch (this.code) {
      case 'INVALID_FILE':
        return 'El archivo debe ser un PDF válido.';
      case 'TOO_LARGE':
        return `PDF demasiado grande. Máximo 10MB.`;
      case 'TOO_MANY_PAGES':
        return 'PDF tiene demasiadas páginas. Máximo 50 páginas.';
      case 'CORRUPTED':
        return 'El PDF está corrupto o no se puede leer.';
      case 'ANALYSIS_FAILED':
        return 'No pude analizar el contenido del PDF. Intenta con otro archivo.';
      default:
        return this.message;
    }
  }
}

/**
 * Type guard to check if error is a VoiceCommandError
 */
export function isVoiceCommandError(error: unknown): error is VoiceCommandError {
  return error instanceof VoiceCommandError;
}

/**
 * Type guard to check if error is a PDFError
 */
export function isPDFError(error: unknown): error is PDFError {
  return error instanceof PDFError;
}

/**
 * Get user-friendly message from any error (UPDATED)
 */
export function getUserMessage(error: unknown): string {
  if (isAPIError(error)) return error.userMessage;
  if (isValidationError(error)) return error.userMessage;
  if (isRateLimitError(error)) return error.userMessage;
  if (isStorageQuotaError(error)) return error.userMessage;
  if (isVoiceCommandError(error)) return error.userMessage;
  if (isPDFError(error)) return error.userMessage;
  if (error instanceof Error) return error.message;
  return String(error);
}
