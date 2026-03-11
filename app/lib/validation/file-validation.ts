/**
 * @file file-validation.ts
 * @module app/lib/file-validation
 *
 * ============================================================
 * UTILIDADES PURAS — VALIDACIÓN DE ARCHIVOS SUBIDOS
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone funciones puras para validar archivos antes de enviarlos a la
 *   API de IA. Validan tipo MIME, tamaño en MB y la combinación de ambos.
 *   Incluye también `bytesToMB`, el helper de conversión de bytes a MB.
 *
 * CONTEXTO EN GIMA:
 *   Las features de IA (análisis de PDFs, análisis de imágenes, transcripción
 *   de audio) reciben archivos del usuario. Validar antes de enviar evita:
 *     a) Errores 413 (Payload Too Large) en la API de Gemini.
 *     b) Consumo innecesario de cuota de tokens con archivos rechazables.
 *     c) UX degradada por subidas largas que terminarán fallando.
 *
 * POR QUÉ UN MÓDULO SEPARADO (NO EN EL HOOK):
 *   Extraído de `useFileUpload` para cumplir con RULES.md §1.2 (hooks < 100L)
 *   y el principio de separación de concerns: la lógica pura de validación
 *   vive en `lib/`, los hooks de React en `hooks/`.
 *   Al ser funciones puras (sin imports de React), pueden usarse en:
 *     - Server Actions (`files.ts`, `vision.ts`, `voice.ts`)
 *     - Client Components (`useFileUpload`)
 *     - Tests unitarios sin necesidad de jsdom
 *
 * PATRÓN DE RESULTADO:
 *   Todas las funciones retornan `FileValidationResult { valid, error? }`.
 *   Esto permite al caller manejar el error con la UI que corresponda
 *   (toast, mensaje inline, estado del form) sin necesidad de try/catch.
 *
 * ORDEN DE VALIDACIÓN EN `validateFile`:
 *   Primero tipo, luego tamaño. El tipo se valida primero porque un archivo
 *   del tipo incorrecto puede tener cualquier tamaño — y el mensaje "tipo
 *   inválido" es más útil para el usuario que "demasiado grande" si ambos
 *   fallan.
 *
 * RELACIÓN CON LÍMITES GLOBALES:
 *   Las constantes `MAX_PDF_SIZE_MB`, `MAX_IMAGE_SIZE_MB`, `MAX_AUDIO_SIZE_MB`
 *   definidas en `app/config/limits.ts` se pasan como `maxSizeMB` al llamar
 *   a estas funciones. No se importan aquí para mantener el módulo libre de
 *   dependencias de configuración y facilitar los tests.
 *
 */

// ============================================================
// TIPOS
// ============================================================

/**
 * Resultado de una operación de validación de archivo.
 *
 * @property valid - True si el archivo pasa la validación.
 * @property error - Mensaje de error en español para mostrar al usuario.
 *                   Solo presente cuando `valid` es false.
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================

/**
 * Valida el tipo MIME de un archivo contra la lista de tipos aceptados.
 *
 * CUÁNDO USARLO:
 *   Antes de enviar un archivo a una Server Action de IA. Ej: verificar que
 *   el usuario subió un PDF (application/pdf) y no un Word (.docx) antes
 *   de llamar a `analyzePdf`.
 *
 * NOTA SOBRE TIPOS MIME EN MÓVIL:
 *   En iOS, algunos archivos PDF pueden llegar con `file.type = ''` si el
 *   sistema operativo no detecta el MIME correctamente. En ese caso esta
 *   función retornará `valid: false`. Si esto es un problema, considerar
 *   validar también por extensión de nombre de archivo como fallback.
 *
 * @param file          - Archivo a validar (objeto File del navegador).
 * @param acceptedTypes - Array de MIME types aceptados. Ej: ['image/jpeg', 'image/png', 'image/webp'].
 * @returns { valid: true } si el tipo está en la lista, o { valid: false, error } si no.
 *
 * @example
 *   validateFileType(file, ['application/pdf'])
 *   // → { valid: false, error: "Tipo de archivo no válido. Solo se aceptan: application/pdf" }
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
 * Valida que el tamaño de un archivo no supere el límite permitido.
 *
 * CUÁNDO USARLO:
 *   Antes de leer el contenido del archivo con `arrayBuffer()`. Si el archivo
 *   supera el límite, leer su contenido solo desperdiciaría memoria antes
 *   de que falle la validación posterior.
 *
 * @param file      - Archivo a validar.
 * @param maxSizeMB - Tamaño máximo permitido en megabytes.
 *                    Usar las constantes de `app/config/limits.ts`:
 *                    MAX_PDF_SIZE_MB, MAX_IMAGE_SIZE_MB, MAX_AUDIO_SIZE_MB.
 * @returns { valid: true } si el tamaño es aceptable, o { valid: false, error } con el tamaño real.
 *
 * @example
 *   validateFileSize(file, 10)
 *   // Si file.size > 10MB:
 *   // → { valid: false, error: "Archivo demasiado grande (12.3MB). Máximo: 10MB" }
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
 * Valida un archivo contra todos los criterios (tipo y tamaño) en un solo paso.
 *
 * ORDEN DE VALIDACIÓN:
 *   1. Tipo MIME primero — error más informativo si el usuario subió el tipo equivocado.
 *   2. Tamaño después — solo tiene sentido validar el tamaño si el tipo es correcto.
 *
 * CUÁNDO USARLO:
 *   Punto de entrada preferido para validaciones en Server Actions y hooks.
 *   Equivalente a llamar `validateFileType` + `validateFileSize` secuencialmente,
 *   pero con cortocircuito: retorna el primer error encontrado.
 *
 * @param file    - Archivo a validar.
 * @param options - Criterios de validación.
 * @param options.acceptedTypes - Array de MIME types aceptados.
 * @param options.maxSizeMB     - Tamaño máximo en megabytes.
 * @returns { valid: true } si pasa ambas validaciones, o { valid: false, error } con el primer fallo.
 *
 * @example
 *   validateFile(file, {
 *     acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
 *     maxSizeMB: MAX_IMAGE_SIZE_MB,
 *   })
 */
export function validateFile(
  file: File,
  options: {
    acceptedTypes: string[];
    maxSizeMB: number;
  }
): FileValidationResult {
  const typeResult = validateFileType(file, options.acceptedTypes);
  if (!typeResult.valid) {
    return typeResult;
  }

  const sizeResult = validateFileSize(file, options.maxSizeMB);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true };
}

// ============================================================
// UTILIDADES DE CONVERSIÓN
// ============================================================

/**
 * Convierte un tamaño en bytes a megabytes con 2 decimales de precisión.
 *
 * CUÁNDO USARLO:
 *   - En las Server Actions de IA (`files.ts`, `vision.ts`, `voice.ts`)
 *     para comparar `file.size` contra los límites en MB.
 *   - En los mensajes de error de `validateFileSize` para mostrar el tamaño
 *     real del archivo en MB.
 *
 * @param bytes - Tamaño del archivo en bytes (propiedad `File.size`).
 * @returns Tamaño en MB redondeado a 2 decimales.
 *
 * @example
 *   bytesToMB(5242880)  // → 5.00
 *   bytesToMB(1572864)  // → 1.50
 */
export function bytesToMB(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}
