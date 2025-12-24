/**
 * Calcula el tamaño aproximado de un string base64 en bytes
 */
export function getBase64Size(base64: string): number {
  // Remover data URL prefix si existe
  const cleanBase64 = base64.split('base64,').pop() || base64;
  // Cada carácter base64 representa 6 bits, pero con padding, ~75% del tamaño string
  return (cleanBase64.length * 3) / 4;
}
