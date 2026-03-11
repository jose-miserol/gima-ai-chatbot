/**
 * @file media-types.ts
 * @module app/utils/media-types
 *
 * ============================================================
 * UTILIDAD — DETECCIÓN DE FORMATOS DE AUDIO DEL NAVEGADOR
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Provee funciones para detectar en tiempo de ejecución qué formatos de audio
 *   soporta el navegador del usuario, con priorización para máxima calidad
 *   y manejo especial de Safari/iOS que usa codecs diferentes a Chrome/Firefox.
 *
 * POR QUÉ ES NECESARIA LA DETECCIÓN DINÁMICA:
 *   El hook `useVoiceInput` usa MediaRecorder para capturar audio. El problema
 *   es que cada navegador soporta diferentes MIME types:
 *
 *   - Chrome/Edge:   `audio/webm;codecs=opus` (mejor compresión)
 *   - Firefox:       `audio/ogg;codecs=opus` (WebM puede no funcionar)
 *   - Safari/iOS:    `audio/mp4` (no soporta WebM ni OGG)
 *   - Navegadores viejos: solo `audio/wav` (sin compresión)
 *
 *   Si se hardcodea `audio/webm` y el usuario usa Safari, MediaRecorder lanzará
 *   un error al intentar grabar. La detección dinámica evita este problema.
 *
 * ESTRATEGIA DE PRIORIZACIÓN:
 *   Los formatos están ordenados por: calidad de compresión > compatibilidad amplia.
 *   `audio/webm;codecs=opus` es el preferido porque ofrece la mejor relación
 *   calidad/tamaño, reduciendo el costo de tokens en Gemini y el tiempo de
 *   upload en conexiones lentas de campo.
 *
 * DÓNDE SE USA:
 *   - app/hooks/use-voice-input.ts → startGeminiRecording()
 *     Para crear el MediaRecorder con el MIME type correcto según el navegador.
 * ============================================================
 */

/**
 * Determina el MIME type de audio soportado por el navegador actual.
 *
 * QUÉ HACE:
 *   Itera una lista de formatos de audio en orden de preferencia y retorna
 *   el primero que el navegador soporte según `MediaRecorder.isTypeSupported()`.
 *
 * ORDEN DE PRIORIDAD Y RAZONAMIENTO:
 *   1. `audio/webm;codecs=opus`  → Chrome, Edge, Firefox (cuando soporta WebM)
 *      Mejor opción: Opus es el codec más eficiente para voz, ~70% más pequeño
 *      que MP3 a la misma calidad. Gemini lo procesa nativamente.
 *
 *   2. `audio/webm`              → Chrome/Firefox sin especificar codec
 *      Fallback si el codec Opus no está disponible explícitamente pero WebM sí.
 *
 *   3. `audio/mp4`               → Safari, iOS, Edge antiguo
 *      Usa el codec AAC internamente. Obligatorio para Apple devices.
 *      Sin este fallback, los técnicos con iPhone no podrían usar la voz.
 *
 *   4. `audio/ogg;codecs=opus`   → Firefox sin soporte de WebM
 *      Mismo codec Opus pero en contenedor OGG, que algunos Firefox prefieren.
 *
 *   5. `audio/wav`               → Fallback universal (sin compresión)
 *      Todos los navegadores lo soportan. Problema: archivos muy grandes
 *      (10MB por minuto) → mayor costo en tokens y tiempo de upload.
 *      Solo se usa como último recurso.
 *
 * SSR GUARD (`typeof window === 'undefined'`):
 *   MediaRecorder no existe en Node.js. Si este módulo se importa en un
 *   Server Component o durante SSR, lanzaría ReferenceError sin este check.
 *
 * @returns El MIME type del primer formato soportado por el navegador.
 * @throws Error con mensaje descriptivo si MediaRecorder no está disponible
 *         o si ningún formato de la lista es soportado.
 *
 * @example
 * ```typescript
 * try {
 *   const mimeType = getSupportedAudioMimeType();
 *   // mimeType === 'audio/webm;codecs=opus' en Chrome
 *   // mimeType === 'audio/mp4'             en Safari
 *   const recorder = new MediaRecorder(stream, { mimeType });
 * } catch (error) {
 *   console.error('No se puede grabar audio:', error.message);
 *   // Activar fallback a Web Speech API nativa
 * }
 * ```
 */
export function getSupportedAudioMimeType(): string {
  // Guard de SSR: MediaRecorder solo existe en el navegador
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    throw new Error('MediaRecorder not supported');
  }

  // Lista ordenada por calidad de compresión descendente
  const audioFormats = [
    'audio/webm;codecs=opus', // Chrome/Firefox: mejor calidad y compresión (preferido)
    'audio/webm', // Chrome/Firefox: fallback sin especificar codec
    'audio/mp4', // Safari/iOS/Edge: único formato compatible en Apple
    'audio/ogg;codecs=opus', // Firefox alternativo: OGG container con Opus
    'audio/wav', // Universal: sin compresión, archivos grandes (último recurso)
  ];

  for (const format of audioFormats) {
    if (MediaRecorder.isTypeSupported(format)) {
      return format; // Retornar el primer formato que el navegador declare soportar
    }
  }

  // Si ningún formato funciona, lanzar con info del user agent para diagnóstico
  throw new Error(`No supported audio format found. Browser: ${navigator.userAgent}`);
}

/**
 * Obtiene la extensión de archivo correspondiente a un MIME type de audio.
 *
 * QUÉ HACE:
 *   Mapea el MIME type retornado por `getSupportedAudioMimeType()` a la extensión
 *   de archivo correcta. Útil al nombrar el archivo de audio antes de descargarlo
 *   o mostrarlo en la UI.
 *
 * POR QUÉ `mimeType.includes()` Y NO UNA COMPARACIÓN EXACTA:
 *   Los MIME types pueden tener parámetros adicionales (ej: `audio/webm;codecs=opus`).
 *   Una comparación exacta fallaría con el codec incluido. `.includes('webm')`
 *   detecta correctamente tanto `audio/webm` como `audio/webm;codecs=opus`.
 *
 * @param mimeType - MIME type del audio (ej: 'audio/webm;codecs=opus', 'audio/mp4').
 * @returns Extensión sin punto: 'webm', 'mp4', 'ogg', 'wav' o 'audio' (fallback genérico).
 *
 * @example
 * ```typescript
 * getAudioExtension('audio/webm;codecs=opus') // → 'webm'
 * getAudioExtension('audio/mp4')              // → 'mp4'
 * getAudioExtension('audio/ogg;codecs=opus')  // → 'ogg'
 * getAudioExtension('audio/wav')              // → 'wav'
 * getAudioExtension('audio/unknown')          // → 'audio'
 * ```
 */
export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'audio'; // Extensión genérica si el formato no está en la lista
}

/**
 * Verifica si el navegador actual soporta la API MediaRecorder.
 *
 * QUÉ HACE:
 *   Comprobación rápida para saber si es posible usar grabación de audio
 *   antes de intentar solicitar permisos de micrófono.
 *
 * CUÁNDO USAR ESTO VS getSupportedAudioMimeType():
 *   - `isMediaRecorderSupported()`: check rápido para mostrar/ocultar el botón de voz en la UI.
 *   - `getSupportedAudioMimeType()`: para obtener el formato correcto justo antes de grabar.
 *   Son complementarios, no alternativos.
 *
 * @returns `true` si MediaRecorder está disponible en el navegador (incluye SSR guard).
 */
export function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && !!window.MediaRecorder;
}
