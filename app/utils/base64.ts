/**
 * Base64 Utility
 *
 * Funciones helper para manipulación y cálculo de datos base64.
 */

/**
 * Calcula el tamaño aproximado de un string base64 en bytes.
 *
 * Útil para validar límites de tamaño antes de enviar archivos a APIs
 * como Gemini Vision o transcripción de audio.
 *
 * @param base64 - String en formato base64 (puede incluir data URL prefix)
 * @returns Tamaño aproximado en bytes
 *
 * @example
 * ```typescript
 * const sizeBytes = getBase64Size("data:image/jpeg;base64,/9j/4AAQ...");
 * console.log(`Tamaño: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
 * ```
 */
export function getBase64Size(base64: string): number {
  // Remover data URL prefix si existe
  const cleanBase64 = base64.split('base64,').pop() || base64;
  // Cada carácter base64 representa 6 bits, pero con padding, ~75% del tamaño string
  return (cleanBase64.length * 3) / 4;
}
