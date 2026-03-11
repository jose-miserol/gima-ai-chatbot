/**
 * @file limits.ts
 * @module app/config/limits
 *
 * ============================================================
 * CONFIGURACIÓN CENTRALIZADA DE LÍMITES DE TAMAÑO Y CANTIDAD
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Define todas las constantes de límite del sistema GIMA en un solo lugar:
 *   tamaños máximos de archivos (audio, imagen, PDF), límites de mensajes
 *   de chat y funciones utilitarias de conversión y verificación de tamaños.
 *
 * POR QUÉ EXISTE (y por qué no están hardcodeadas):
 *   Los límites aparecen en múltiples partes del sistema:
 *   - En las Server Actions (voice.ts, vision.ts, files.ts) para validar uploads.
 *   - En los componentes de UI para mostrar mensajes de error con el tamaño correcto.
 *   - En next.config.ts para bodySizeLimit del servidor.
 *   Si estuvieran hardcodeados, cambiar un límite requeriría buscar todos los
 *   archivos donde aparece "5MB" y actualizarlos manualmente — propenso a errores.
 *   Con esta centralización, se cambia en un solo lugar.
 *
 * CONVENCIÓN DE DOBLE CONSTANTE (BYTES + MB):
 *   Cada límite se expone en dos formatos:
 *   - `_BYTES`: para comparaciones exactas en código (file.size > MAX_IMAGE_SIZE_BYTES).
 *   - `_MB`: para mensajes de error legibles ("Máximo permitido: 5MB").
 *   Esto evita conversiones en el lugar de uso y hace el código más expresivo.
 *
 * DÓNDE SE IMPORTA:
 *   - app/actions/voice.ts    → MAX_AUDIO_SIZE_MB, bytesToMB
 *   - app/actions/vision.ts   → MAX_IMAGE_SIZE_MB, bytesToMB
 *   - app/actions/files.ts    → MAX_PDF_SIZE_MB, bytesToMB
 *   - Componentes de UI que muestran límites al usuario
 *   - Re-exportado desde app/config/index.ts
 * ============================================================
 */

// ========================================
// LÍMITES DE SERVER ACTIONS Y API
// ========================================

/**
 * Límite máximo del body para Server Actions de Next.js (en bytes).
 *
 * QUÉ ES: Tamaño máximo del cuerpo de una petición HTTP procesada por Server Actions.
 * POR QUÉ 5MB: Balance entre soportar archivos medianos (imágenes, audios cortos)
 *              y proteger el servidor de requests abusivos.
 * IMPORTANTE: Este valor debe coincidir con `bodySizeLimit` en next.config.ts.
 *             Si se desincroniza, Next.js rechazará requests antes de que lleguen
 *             a la validación de esta constante.
 */
export const SERVER_ACTION_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5MB en bytes

/**
 * Límite máximo del body para Server Actions (en MB, legible para UI).
 * Usar en mensajes de error: `"El archivo supera el límite de ${SERVER_ACTION_BODY_SIZE_MB}MB"`
 */
export const SERVER_ACTION_BODY_SIZE_MB = 5;

// ========================================
// LÍMITES DE AUDIO
// ========================================

/**
 * Tamaño máximo para archivos de audio enviados a transcripción (en bytes).
 *
 * QUÉ APLICA: Grabaciones del micrófono del navegador (formato WebM/opus por defecto).
 * POR QUÉ 5MB: Un audio WebM de 5MB equivale aproximadamente a 3-5 minutos de grabación,
 *              suficiente para cualquier comando de voz en GIMA. Audios más largos
 *              probablemente no son comandos sino errores del usuario.
 * USADO EN: app/actions/voice.ts → transcribeAudio()
 */
export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Tamaño máximo para archivos de audio (en MB, legible para UI y mensajes de error).
 */
export const MAX_AUDIO_SIZE_MB = 5;

// ========================================
// LÍMITES DE IMAGEN
// ========================================

/**
 * Tamaño máximo para imágenes enviadas al análisis de visión (en bytes).
 *
 * QUÉ APLICA: Fotos de piezas industriales tomadas desde cámara de teléfono o tablet.
 * POR QUÉ 5MB: Las fotos modernas pueden superar los 10MB. Limitamos a 5MB para
 *              controlar el consumo de tokens del contexto multimodal de Gemini
 *              (imágenes muy grandes consumen más tokens del presupuesto diario).
 * NOTA: Si el usuario necesita más calidad, puede comprimir la imagen antes de enviarla.
 * USADO EN: app/actions/vision.ts → analyzePartImage()
 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Tamaño máximo para imágenes (en MB, legible para UI y mensajes de error).
 */
export const MAX_IMAGE_SIZE_MB = 5;

// ========================================
// LÍMITES DE PDF
// ========================================

/**
 * Tamaño máximo para documentos PDF enviados a análisis (en bytes).
 *
 * QUÉ APLICA: Manuales técnicos, reportes de mantenimiento, fichas de equipos.
 * POR QUÉ 10MB (más que audio/imagen):
 *   Los manuales técnicos industriales pueden ser documentos extensos.
 *   Gemini Flash soporta hasta 2GB teóricamente, pero se limita a 10MB
 *   por experiencia de usuario (subir más de 10MB es lento en conexiones
 *   móviles que usan los técnicos en campo) y por control de costos.
 * USADO EN: app/actions/files.ts → analyzePdf()
 */
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Tamaño máximo para PDFs (en MB, legible para UI y mensajes de error).
 */
export const MAX_PDF_SIZE_MB = 10;

/**
 * Tipos MIME aceptados para documentos.
 *
 * QUÉ ES: Lista blanca de MIME types válidos para la función analyzePdf.
 * POR QUÉ SOLO PDF: La API de Gemini soporta otros formatos de documento,
 *                   pero GIMA actualmente solo necesita PDFs.
 *                   Agregar 'application/msword' aquí para soporte de .doc en el futuro.
 */
export const SUPPORTED_PDF_MIME_TYPES = ['application/pdf'];

// ========================================
// LÍMITES DE MENSAJES DE CHAT
// ========================================

/**
 * Tamaño máximo del texto de un mensaje individual del usuario (en bytes).
 *
 * QUÉ APLICA: El campo `content` de cada mensaje enviado al endpoint /api/chat.
 * POR QUÉ 10KB: 10KB equivale aproximadamente a 5,000 palabras.
 *               Un técnico nunca escribirá un mensaje de chat más largo que eso.
 *               Previene intentos de inyección de prompts muy largos (prompt stuffing).
 * VALIDADO EN: ChatService dentro de app/lib/services/chat-service.ts
 */
export const MAX_MESSAGE_TEXT_BYTES = 10 * 1024; // 10KB

/**
 * Tamaño máximo del texto de un mensaje (en KB, legible para UI).
 */
export const MAX_MESSAGE_TEXT_KB = 10;

// ========================================
// LÍMITES DE HISTORIAL DE CHAT
// ========================================

/**
 * Número máximo de mensajes a guardar en localStorage del navegador.
 *
 * QUÉ APLICA: Persistencia local del historial de conversaciones
 *             (cuando NEXT_PUBLIC_ENABLE_CHAT_PERSISTENCE=true).
 * POR QUÉ 100: localStorage tiene un límite de ≈5MB por dominio.
 *              100 mensajes de chat promedio (~500 bytes c/u) = ~50KB,
 *              dejando amplio margen para otros datos del localStorage.
 * CONSECUENCIA: Si se superan 100 mensajes, los más antiguos se eliminan
 *               automáticamente (comportamiento FIFO).
 */
export const MAX_STORED_MESSAGES = 100;

// ========================================
// FUNCIONES UTILITARIAS DE CONVERSIÓN
// ========================================

/**
 * Convierte bytes a megabytes con 1 decimal de precisión.
 *
 * QUÉ HACE:
 *   Calcula el tamaño en MB y redondea a 1 decimal para mostrar valores
 *   legibles en mensajes de error (ej: "4.8MB" en lugar de "4.768374MB").
 *
 * USADO EN:
 *   - Mensajes de error: `"Archivo muy grande (${bytesToMB(file.size)}MB)"`
 *   - Comparaciones de límite en Server Actions de voz, imagen y PDF.
 *
 * @param bytes - Cantidad de bytes a convertir.
 * @returns Tamaño en MB redondeado a 1 decimal.
 *
 * @example
 * ```typescript
 * bytesToMB(5242880) // → 5    (exactamente 5MB)
 * bytesToMB(5033164) // → 4.8  (4.8MB, redondeado)
 * bytesToMB(1024)    // → 0    (menos de 0.1MB)
 * ```
 */
export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/**
 * Convierte megabytes a bytes.
 *
 * QUÉ HACE:
 *   Operación inversa a bytesToMB. Útil cuando se necesita convertir
 *   una constante legible (_MB) a bytes para una comparación exacta.
 *
 * @param mb - Cantidad de megabytes a convertir.
 * @returns Tamaño exacto en bytes (sin redondeo).
 *
 * @example
 * ```typescript
 * mbToBytes(5)  // → 5242880
 * mbToBytes(10) // → 10485760
 * ```
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Verifica si un tamaño en bytes supera un límite dado.
 *
 * QUÉ HACE:
 *   Abstracción semántica sobre una comparación simple.
 *   Hace el código de validación más expresivo y legible.
 *
 * @param sizeInBytes  - Tamaño del archivo a verificar.
 * @param limitInBytes - Límite máximo permitido.
 * @returns `true` si el tamaño excede el límite, `false` si está dentro.
 *
 * @example
 * ```typescript
 * // En una Server Action, en lugar de:
 * if (file.size > MAX_IMAGE_SIZE_BYTES) { ... }
 *
 * // Se puede escribir más expresivamente:
 * if (exceedsLimit(file.size, MAX_IMAGE_SIZE_BYTES)) { ... }
 * ```
 */
export function exceedsLimit(sizeInBytes: number, limitInBytes: number): boolean {
  return sizeInBytes > limitInBytes;
}
