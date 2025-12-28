/**
 * Media Types Utility
 *
 * Funciones helper para detección dinámica de formatos de audio
 * soportados por el navegador, con soporte especial para Safari/iOS
 */

/**
 * Determina el MIME type de audio soportado por el navegador actual
 * con priorización para mejor calidad y compatibilidad
 * @returns MIME type soportado (ej: 'audio/webm;codecs=opus', 'audio/mp4')
 * @throws Error si ningún formato está soportado o MediaRecorder no disponible
 * @example
 * ```typescript
 * try {
 *   const mimeType = getSupportedAudioMimeType();
 *   const recorder = new MediaRecorder(stream, { mimeType });
 * } catch (error) {
 *   console.error('MediaRecorder not supported');
 * }
 * ```
 */
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    throw new Error('MediaRecorder not supported');
  }

  // Lista de MIME types ordenados por prioridad (calidad + compatibilidad)
  const audioFormats = [
    'audio/webm;codecs=opus', // Chrome/Firefox - Mejor calidad y compresión
    'audio/webm', // Chrome/Firefox fallback
    'audio/mp4', // Safari/iOS/Edge - AAC codec
    'audio/ogg;codecs=opus', // Firefox fallback
    'audio/wav', // Universal fallback (sin compresión)
  ];

  for (const format of audioFormats) {
    if (MediaRecorder.isTypeSupported(format)) {
      return format;
    }
  }

  // Si ninguno está soportado, lanzar error descriptivo
  throw new Error(`No supported audio format found. Browser: ${navigator.userAgent}`);
}

/**
 * Obtiene la extensión de archivo basada en MIME type
 * @param mimeType - MIME type del audio (ej: 'audio/webm;codecs=opus')
 * @returns Extensión de archivo sin punto (ej: 'webm', 'mp4')
 * @example
 * ```typescript
 * const ext = getAudioExtension('audio/webm;codecs=opus');
 * console.log(ext); // 'webm'
 * ```
 */
export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'audio';
}

/**
 * Verifica si el navegador soporta MediaRecorder
 * @returns true si MediaRecorder está disponible
 */
export function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && !!window.MediaRecorder;
}
