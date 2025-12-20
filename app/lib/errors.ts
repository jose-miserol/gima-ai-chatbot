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
 * Get user-friendly message from any error
 */
export function getUserMessage(error: unknown): string {
  if (isAPIError(error)) return error.userMessage;
  if (isValidationError(error)) return error.userMessage;
  if (isRateLimitError(error)) return error.userMessage;
  if (isStorageQuotaError(error)) return error.userMessage;
  if (error instanceof Error) return error.message;
  return String(error);
}
