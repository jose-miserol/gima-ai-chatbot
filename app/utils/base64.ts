/**
 * @file base64.ts
 * @module app/utils/base64
 *
 * ============================================================
 * UTILIDAD — MANIPULACIÓN Y CÁLCULO DE DATOS BASE64
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Provee funciones helper para trabajar con strings en formato base64,
 *   con foco en el cálculo de tamaño real de datos antes de enviarlos
 *   a las APIs de Gemini (voz, imagen, PDF).
 *
 * POR QUÉ ES NECESARIO CALCULAR EL TAMAÑO DE BASE64:
 *   Cuando un archivo binario (audio, imagen, PDF) se convierte a base64,
 *   su tamaño aumenta aproximadamente un 33% porque cada 3 bytes de datos
 *   binarios se representan como 4 caracteres ASCII.
 *
 *   Ejemplo:
 *   - Archivo original: 5 MB (5,242,880 bytes)
 *   - String base64:    ≈ 6.9 MB de caracteres
 *   - Bytes reales del dato: ≈ 5 MB (lo que Gemini procesa)
 *
 *   Para validar el límite de tamaño antes de enviar a la API,
 *   necesitamos conocer los BYTES REALES del binario original,
 *   no la longitud del string base64. Esta función hace esa conversión.
 *
 * DÓNDE SE USA:
 *   - app/actions/voice.ts → validar tamaño del audio antes de Gemini
 *   - El módulo de imagen y PDF usan `file.size` directamente porque
 *     reciben un objeto File, no un string base64
 * ============================================================
 */

/**
 * Calcula el tamaño aproximado en bytes del dato binario representado por un string base64.
 *
 * QUÉ HACE:
 *   Implementa la fórmula matemática de decodificación base64 para estimar
 *   cuántos bytes reales contiene el dato sin necesidad de decodificarlo completamente.
 *   Esto es más eficiente que hacer `atob(base64).length` que sí decodifica todo.
 *
 * FÓRMULA USADA:
 *   `(longitud_base64_limpio * 3) / 4`
 *
 *   Fundamento: cada 4 caracteres base64 representan exactamente 3 bytes.
 *   Por lo tanto: bytes = (caracteres / 4) * 3 = caracteres * 3/4
 *
 *   NOTA: La fórmula exacta debería descontar los caracteres de padding `=`
 *   al final del string (cada `=` reduce el resultado en 1 byte). Esta
 *   implementación no los descuenta, por lo que el resultado puede ser
 *   hasta 2 bytes mayor que el real. Para validaciones de límite de tamaño,
 *   este margen es despreciable y la sobrestimación es conservadora (segura).
 *
 * MANEJO DEL PREFIJO data URL:
 *   Los navegadores generan base64 con formato data URL:
 *   `data:audio/webm;base64,/9j/4AAQSkZJRgAB...`
 *   El prefijo `data:audio/webm;base64,` no es parte de los datos reales.
 *   Se elimina con `.split('base64,').pop()` antes de calcular el tamaño.
 *
 * @param base64 - String base64, con o sin prefijo data URL.
 * @returns Tamaño aproximado en bytes del dato binario original.
 *
 * @example
 * ```typescript
 * // Con data URL (típico de FileReader.readAsDataURL):
 * const sizeBytes = getBase64Size("data:audio/webm;base64,/9j/4AAQ...");
 * console.log(`Tamaño: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
 *
 * // Base64 puro:
 * const sizeBytes = getBase64Size("/9j/4AAQSkZJRgAB...");
 *
 * // Validación de límite antes de enviar a Gemini:
 * const MAX_AUDIO_MB = 5;
 * if (getBase64Size(audioBase64) > MAX_AUDIO_MB * 1024 * 1024) {
 *   throw new Error('Audio demasiado grande');
 * }
 * ```
 */
export function getBase64Size(base64: string): number {
  // Eliminar el prefijo del data URL si existe (ej: "data:audio/webm;base64,")
  // .split('base64,').pop() retorna todo lo que está después de "base64,"
  // Si no hay prefijo, pop() retorna el string original completo
  const cleanBase64 = base64.split('base64,').pop() || base64;

  // Fórmula: cada carácter base64 representa 6 bits → 4 chars = 24 bits = 3 bytes
  // Por lo tanto: bytes = longitud * (3/4)
  return (cleanBase64.length * 3) / 4;
}
