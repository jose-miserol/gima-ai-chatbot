/**
 * @file ai.ts
 * @module app/constants/ai
 *
 * ============================================================
 * CONSTANTES DE CONFIGURACIÓN DE IA — PARÁMETROS TÉCNICOS INTERNOS
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Centraliza toda la configuración técnica de los modelos de IA usados
 *   en GIMA: qué modelo usa cada feature, sus parámetros (temperatura,
 *   maxTokens), timeouts, rate limits, tipos de enumeración y listas de
 *   validación para checklists, resúmenes y comandos de voz.
 *
 * DIFERENCIA CON models.ts (en app/config):
 *   - `models.ts` → Catálogo PÚBLICO para el selector de UI del usuario.
 *                   Solo contiene lo que el usuario puede elegir manualmente.
 *
 *   - `ai.ts` (este archivo) → Configuración INTERNA para cada feature de IA.
 *                               El usuario no interactúa con estos valores.
 *                               Define qué modelo usa cada tarea internamente.
 *
 * ARQUITECTURA DE PROVEEDORES EN GIMA:
 *   GROQ (Llama 3.3 70B)      → Chat, checklists, resúmenes
 *   Google Gemini Flash       → Imágenes, PDFs
 *   Google Gemini Flash Lite  → Transcripción de voz
 *   La separación por proveedor se debe a que Gemini es el único que
 *   soporta input multimodal (audio, imagen, documento) nativamente.
 *   GROQ/Llama se usa para generación de texto por su baja latencia.
 *
 * DÓNDE SE IMPORTA:
 *   - Servicios de IA en app/lib/services/ (checklist, activity-summary)
 *   - Server Actions que usan modelos específicos
 *   - app/components/features/ai-tools/ para validación de operaciones
 * ============================================================
 */

// ============================================================
// IDENTIFICADORES DE MODELOS
// ============================================================

/**
 * AI_MODELS — Identificadores exactos de los modelos por proveedor.
 *
 * QUÉ ES:
 *   Objeto anidado con los strings de identificación de modelos que se
 *   pasan directamente a los clientes de API (google(), groq()).
 *
 * POR QUÉ SEPARADO DE AI_TASK_MODELS:
 *   AI_MODELS es la fuente de verdad de los identificadores.
 *   AI_TASK_MODELS los referencia en lugar de hardcodear strings.
 *   Si Google cambia el nombre de un modelo (ej: "gemini-2.5-flash" →
 *   "gemini-3-flash"), se actualiza solo en AI_MODELS y se propaga a todas
 *   las tareas que lo usan automáticamente.
 *
 * ESTRUCTURA:
 *   AI_MODELS.GROQ.LLAMA_3_3_70B → 'llama-3.3-70b-versatile'
 *   AI_MODELS.GEMINI.FLASH_LITE   → 'gemini-2.5-flash-lite'
 *   AI_MODELS.GEMINI.FLASH        → 'gemini-2.5-flash'
 */
export const AI_MODELS = {
  /** Modelos de GROQ — Generación de texto con baja latencia */
  GROQ: {
    LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  },
  /** Modelos de Google Gemini — Multimodal (voz, imagen, PDF) */
  /** Flash Lite: versión económica para transcripción de voz (solo texto) */
  /** Flash: versión completa para análisis multimodal (imagen + PDF) */
  GEMINI: {
    FLASH_LITE: 'gemini-2.5-flash-lite',
    FLASH: 'gemini-2.5-flash',
  },
} as const;

// ============================================================
// CONFIGURACIÓN POR TAREA
// ============================================================

/**
 * AI_TASK_MODELS — Configuración completa de modelo para cada feature de GIMA.
 *
 * QUÉ ES:
 *   Objeto que mapea cada tarea de IA a su configuración óptima:
 *   proveedor, modelo, temperatura y maxTokens. Es la guía de referencia
 *   para cualquier desarrollador que implemente o modifique una feature de IA.
 *
 * CAMPOS DE CADA TAREA:
 *   - provider:     Qué cliente de AI SDK usar ('GROQ' o 'GEMINI').
 *   - model:        Identificador del modelo (referenciado desde AI_MODELS).
 *   - temperature:  Creatividad del modelo [0-1]. 0 = determinista, 1 = creativo.
 *   - maxTokens:    Límite de tokens en la respuesta (controla costo y largo).
 *
 * LÓGICA DE TEMPERATURA POR TAREA:
 *   - 0   (VOICE_TRANSCRIPTION, VOICE_COMMAND_PARSING): máxima precisión, sin variación.
 *   - 0.1 (DATA_TRANSFORMATION, PDF_EXTRACTION): datos estructurados, mínima creatividad.
 *   - 0.2 (IMAGE_ANALYSIS): análisis técnico con algo de flexibilidad.
 *   - 0.3 (CHECKLIST, WORK_ORDER_CLOSEOUT): texto profesional con algo de variedad.
 *   - 0.4 (ACTIVITY_SUMMARY): resúmenes narrativos con estilo natural.
 *   - undefined (CHAT): usa el default del modelo (balance entre precisión y naturalidad).
 *
 */
export const AI_TASK_MODELS = {
  // ============================================================
  // GROQ — Generación de Texto
  // ============================================================

  /**
   * CHAT — Chat conversacional principal de GIMA.
   *
   * USADO EN: app/api/chat/route.ts → ChatService.processMessage()
   * TEMPERATURA: undefined (default del modelo) — balance entre precisión y fluidez.
   */
  CHAT: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: undefined, // Usa el default del modelo
  },

  /**
   * CHECKLIST_GENERATION — Generación de checklists de mantenimiento.
   *
   * USADO EN: app/lib/services/checklist-ai-service.ts
   * TEMPERATURA: 0.3 — suficiente creatividad para variar la redacción de los ítems
   *              sin inventar procedimientos inexistentes.
   * MAX_TOKENS: 2000 — un checklist detallado puede tener 20-40 ítems con descripciones.
   */
  CHECKLIST_GENERATION: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.3,
    maxTokens: 2000,
  },

  /**
   * ACTIVITY_SUMMARY — Resúmenes automáticos de actividades de mantenimiento.
   *
   * USADO EN: app/lib/services/activity-summary-ai-service.ts
   * TEMPERATURA: 0.4 — resúmenes deben sonar naturales y no repetitivos,
   *              lo que requiere algo más de variedad en la redacción.
   * MAX_TOKENS: 500 — resúmenes cortos y ejecutivos (no reportes completos).
   */
  ACTIVITY_SUMMARY: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.4,
    maxTokens: 500,
  },

  /**
   * DATA_TRANSFORMATION — Transformaciones de datos estructurados.
   *
   * USADO EN: app/lib/services/ (cuando se migre desde Gemini)
   * TEMPERATURA: 0.1 — transformaciones de datos deben ser deterministas
   *              y reproducibles. Alta temperatura causaría resultados inconsistentes.
   * MAX_TOKENS: 1000 — suficiente para datasets medianos transformados.
   */
  DATA_TRANSFORMATION: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.1,
    maxTokens: 1000,
  },

  /**
   * WORK_ORDER_CLOSEOUT — Notas de cierre para órdenes de trabajo.
   *
   * USADO EN: Por implementar en app/lib/services/
   * TEMPERATURA: 0.3 — documentación técnica con redacción variada pero precisa.
   * MAX_TOKENS: 800 — notas de cierre concisas (diagnóstico, acciones, resultado).
   */
  WORK_ORDER_CLOSEOUT: {
    provider: 'GROQ' as const,
    model: AI_MODELS.GROQ.LLAMA_3_3_70B,
    temperature: 0.3,
    maxTokens: 800,
  },

  // ============================================================
  // Gemini — Multimodal (Voz, Imagen, PDF)
  // ============================================================

  /**
   * VOICE_TRANSCRIPTION — Transcripción de audio a texto.
   *
   * USADO EN: app/actions/voice.ts → transcribeAudio()
   * TEMPERATURA: 0 — transcripción debe ser exactamente lo que se dijo, sin variación.
   * MAX_TOKENS: 500 — los comandos de voz son cortos; si supera 500 tokens, algo falla.
   */
  VOICE_TRANSCRIPTION: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH_LITE,
    temperature: 0,
    maxTokens: 500,
  },

  /**
   * VOICE_COMMAND_PARSING — Parsing de transcripción a comando estructurado JSON.
   *
   * USADO EN: app/lib/services/voice-command-parser.ts
   * TEMPERATURA: 0 — el parsing de intención debe ser determinista y consistente.
   * MAX_TOKENS: 300 — un objeto JSON de comando es compacto (action + params).
   */
  VOICE_COMMAND_PARSING: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH_LITE,
    temperature: 0,
    maxTokens: 300,
  },

  /**
   * IMAGE_ANALYSIS — Análisis de imágenes de piezas industriales.
   *
   * USADO EN: app/actions/vision.ts → analyzePartImage()
   * TEMPERATURA: 0.2 — el análisis de imagen necesita algo de flexibilidad para
   *              identificar piezas ambiguas, pero no tanta como para inventar.
   * MAX_TOKENS: 1000 — el objeto JSON con descripción, marca, modelo y specs puede
   *             ser extenso para equipos complejos.
   */
  IMAGE_ANALYSIS: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH,
    temperature: 0.2,
    maxTokens: 1000,
  },

  /**
   * PDF_EXTRACTION — Extracción de contenido de documentos PDF.
   *
   * USADO EN: app/actions/files.ts → analyzePdf()
   * TEMPERATURA: 0.1 — extracción de información técnica de manuales; baja creatividad.
   * MAX_TOKENS: 2000 — los análisis de PDFs técnicos extensos pueden ser largos.
   * POR QUÉ FLASH: Contexto de 1M tokens, necesario para manuales de cientos de páginas.
   */
  PDF_EXTRACTION: {
    provider: 'GEMINI' as const,
    model: AI_MODELS.GEMINI.FLASH,
    temperature: 0.1,
    maxTokens: 2000,
  },
} as const;

// ============================================================
// CONFIGURACIÓN DE CACHÉ
// ============================================================

/**
 * AI_CACHE_TTL — Tiempo de vida del caché para cada tipo de operación de IA (segundos).
 *
 * QUÉ ES:
 *   Define cuánto tiempo se puede cachear la respuesta de cada tipo de operación
 *   antes de que necesite regenerarse.
 *
 * LÓGICA DE CADA VALOR:
 *   CHECKLIST (3600s = 1h):
 *     Los checklists para el mismo tipo de equipo son similares pero el personal
 *     podría actualizar los procedimientos. 1 hora es seguro.
 *
 *   SUMMARY (604800s = 7 días):
 *     Los resúmenes de actividades pasadas no cambian una vez generados
 *     (son historia). 7 días es conservador.
 *
 *   VOICE_COMMAND (0 = sin caché):
 *     Cada comando de voz es único e irrepetible. Cachear llevaría a ejecutar
 *     comandos antiguos por error.
 *
 *   TRANSFORMATION_PREVIEW (300s = 5 min):
 *     Las previsualizaciones de transformación son temporales y específicas
 *     al dataset del momento. 5 minutos es suficiente para que el usuario
 *     revise y confirme.
 *
 *   WORK_ORDER_CLOSEOUT (0 = sin caché):
 *     Las notas de cierre son únicas por orden de trabajo. Nunca cachear.
 */
export const AI_CACHE_TTL = {
  CHECKLIST: 3600, // 1 hora
  SUMMARY: 604800, // 7 días
  VOICE_COMMAND: 0, // Sin caché (cada comando es único)
  TRANSFORMATION_PREVIEW: 300, // 5 minutos
  WORK_ORDER_CLOSEOUT: 0, // Sin caché (único por OT)
} as const;

// ============================================================
// RATE LIMITING DE IA
// ============================================================

/**
 * AI_RATE_LIMITS — Límites de requests por minuto y por día según nivel de plan.
 *
 * QUÉ ES:
 *   Configuración de cuotas de uso de la API de IA por tier de usuario.
 *   Permite escalar los límites según el plan contratado sin tocar el código
 *   de rate limiting — solo se cambia aquí.
 *
 * NOTA DE IMPLEMENTACIÓN:
 *   Actualmente GIMA es sistema interno de la UNEG (sin planes de usuario).
 *   Estos tiers están preparados para una posible expansión SaaS futura
 *   o para configurar límites por departamento de la universidad.
 */
export const AI_RATE_LIMITS = {
  FREE_TIER: {
    requestsPerMinute: 10, // 10 requests/min → sin abuso accidental
    requestsPerDay: 100, // 100/día → uso básico
  },
  PRO_TIER: {
    requestsPerMinute: 30,
    requestsPerDay: 1000,
  },
  ENTERPRISE_TIER: {
    requestsPerMinute: 100,
    requestsPerDay: 10000,
  },
} as const;

// ============================================================
// TIMEOUTS
// ============================================================

/**
 * AI_TIMEOUTS — Timeouts por tipo de operación de IA (en milisegundos).
 *
 * QUÉ ES:
 *   Límites de tiempo máximo de espera para cada categoría de operación.
 *   Evita que requests colgados bloqueen el servidor indefinidamente.
 *
 * LÓGICA DE CADA CATEGORÍA:
 *   QUICK (10s):  Parsing de comandos de voz — operación simple, respuesta corta.
 *                 Si tarda más de 10s, algo está mal con la red o el modelo.
 *
 *   NORMAL (30s): Generación de checklists, resúmenes cortos.
 *                 La mayoría de operaciones de texto entran aquí.
 *                 Coincide con STREAM_CONFIG.maxDuration en server.ts.
 *
 *   LONG (60s):   Transformaciones de datos grandes, análisis de PDFs extensos.
 *                 Coincide con maxDuration del route handler en route.ts.
 */
export const AI_TIMEOUTS = {
  QUICK: 10000, // 10s — comandos de voz y parsing
  NORMAL: 30000, // 30s — generación de texto estándar
  LONG: 60000, // 60s — transformaciones y PDFs extensos
} as const;

// ============================================================
// CONFIGURACIÓN DE REINTENTOS
// ============================================================

/**
 * AI_RETRY_CONFIG — Parámetros para reintentos automáticos ante errores de IA.
 *
 * QUÉ ES:
 *   Configuración del mecanismo de retry con exponential backoff.
 *   Usado cuando la API de GROQ o Gemini devuelve errores recuperables
 *   (503 Service Unavailable, 429 Rate Limit, timeouts de red).
 *
 * EXPONENTIAL BACKOFF:
 *   Los reintentos esperan: BASE_BACKOFF × 2^intento (hasta MAX_BACKOFF).
 *   Intento 1: 1000ms, Intento 2: 2000ms, Intento 3: 4000ms... cap en 30s.
 *   Esto evita saturar la API con reintentos inmediatos.
 */
export const AI_RETRY_CONFIG = {
  MAX_RETRIES: 3, // Máximo 3 intentos antes de lanzar error al usuario
  BASE_BACKOFF_MS: 1000, // Espera inicial de 1 segundo
  MAX_BACKOFF_MS: 30000, // Espera máxima de 30 segundos (cap del backoff)
} as const;

// ============================================================
// ENUMERACIONES DE DOMINIO — ACTIVOS Y MANTENIMIENTO
// ============================================================

/**
 * ASSET_TYPES — Tipos de activos industriales soportados en GIMA.
 *
 * QUÉ ES:
 *   Lista de categorías de equipos que el sistema de mantenimiento de la UNEG
 *   maneja. Se usa para:
 *   - Validar el tipo de activo en formularios de alta de inventario.
 *   - Generar checklists específicos para cada tipo de equipo.
 *   - Filtrar activos en las consultas del chat (regla 14 de SYSTEM_PROMPT).
 *
 * CORRELACIÓN CON SYSTEM_PROMPT (regla 14):
 *   Algunos valores aquí corresponden a los que el modelo usa en sus tool calls:
 *   'unidad-hvac' → el modelo usa 'hvac' (el mapeo ocurre en el prompt del sistema).
 */
export const ASSET_TYPES = [
  'unidad-hvac', // Unidades Manejadoras de Aire, chillers, fan coils
  'caldera', // Calderas de vapor o agua caliente
  'bomba', // Bombas centrífugas, de presión, de vacío
  'compresor', // Compresores de aire, refrigeración
  'generador', // Grupos electrógenos, UPS industriales
  'panel-electrico', // Tableros de distribución, centros de control de motores
  'transportador', // Cintas transportadoras, elevadores
  'grua', // Puentes grúa, polipastos
  'montacargas', // Montacargas eléctricos o de combustión
  'otro', // Activos no clasificados en las categorías anteriores
] as const;

/** Tipo TypeScript para validar que un string sea un tipo de activo válido */
export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * TASK_TYPES — Tipos de tareas de mantenimiento.
 *
 * QUÉ ES:
 *   Clasificación estándar del tipo de intervención de mantenimiento.
 *   Corresponde a los campos del backend de Laravel para órdenes de trabajo.
 *
 * DEFINICIONES:
 *   preventivo: mantenimiento programado para evitar fallas (MP en el glosario).
 *   correctivo:  reparación después de que ocurrió una falla (MC en el glosario).
 *   predictivo:  basado en monitoreo de condición (análisis de vibraciones, termografía).
 */
export const TASK_TYPES = ['preventivo', 'correctivo', 'predictivo'] as const;

/** Tipo TypeScript para validar que un string sea un tipo de tarea válido */
export type TaskType = (typeof TASK_TYPES)[number];

// ============================================================
// ESTILOS Y NIVELES DE DETALLE PARA RESÚMENES
// ============================================================

/**
 * SUMMARY_STYLES — Estilos narrativos para los resúmenes de actividad.
 *
 * QUÉ ES:
 *   Opciones de tono para los resúmenes generados por ActivitySummaryAIService.
 *   El usuario puede seleccionar el estilo según el destinatario del reporte.
 *
 * CUÁNDO USAR CADA UNO:
 *   FORMAL:    Informes oficiales para directivos o entes reguladores.
 *   CASUAL:    Comunicación interna entre técnicos del mismo equipo.
 *   TECNICO:   Documentación técnica para ingenieros (incluye terminología específica).
 *   EJECUTIVO: Resúmenes de alto nivel para gerentes (métricas clave, sin detalles técnicos).
 */
export const SUMMARY_STYLES = {
  FORMAL: 'formal',
  CASUAL: 'casual',
  TECNICO: 'tecnico',
  EJECUTIVO: 'ejecutivo',
} as const;

/** Tipo TypeScript para el estilo de resumen seleccionado */
export type SummaryStyle = (typeof SUMMARY_STYLES)[keyof typeof SUMMARY_STYLES];

/**
 * SUMMARY_DETAIL_LEVELS — Niveles de profundidad para los resúmenes de actividad.
 *
 * QUÉ ES:
 *   Controla qué tan extenso es el resumen generado.
 *
 * GUÍA DE USO:
 *   BREVE (1-2 párrafos):      Para notificaciones rápidas o mensajes de Slack.
 *   NORMAL (3-4 párrafos):     Para emails semanales de seguimiento.
 *   DETALLADO (5+ párrafos):   Para reportes mensuales con lista completa de actividades.
 */
export const SUMMARY_DETAIL_LEVELS = {
  BREVE: 'breve', // 1-2 párrafos, puntos más importantes
  NORMAL: 'normal', // 3-4 párrafos, balance entre detalle y brevedad
  DETALLADO: 'detallado', // 5+ párrafos con lista completa de actividades
} as const;

/** Tipo TypeScript para el nivel de detalle del resumen */
export type SummaryDetailLevel = (typeof SUMMARY_DETAIL_LEVELS)[keyof typeof SUMMARY_DETAIL_LEVELS];

// ============================================================
// SEGURIDAD — COMANDOS DE VOZ
// ============================================================

/**
 * DANGEROUS_VOICE_KEYWORDS — Palabras clave peligrosas en comandos de voz.
 *
 * QUÉ ES:
 *   Lista de frases que activan una confirmación adicional antes de ejecutar
 *   el comando de voz. Previene ejecuciones accidentales de operaciones
 *   destructivas por ruido de fondo o mal entendidos.
 *
 * CÓMO SE USA:
 *   VoiceCommandParserService verifica si la transcripción contiene alguna
 *   de estas frases. Si la contiene, requiere confirmación explícita del usuario
 *   antes de procesar el comando.
 *
 * POR QUÉ EN ESPAÑOL E INGLÉS:
 *   Los técnicos pueden usar ambos idiomas. "Delete all" puede aparecer si
 *   el reconocimiento de voz confunde palabras en español.
 */
export const DANGEROUS_VOICE_KEYWORDS = [
  'eliminar todo', // Podría borrar registros de inventario
  'borrar todo', // Equivalente a eliminar todo
  'cancelar todo', // Podría cancelar múltiples órdenes de trabajo
  'delete all', // Versión en inglés
  'remove all', // Versión en inglés
  'cerrar todo', // Podría cerrar múltiples OTs activas
] as const;

// ============================================================
// OPERACIONES DE TRANSFORMACIÓN DE DATOS
// ============================================================

/**
 * ALLOWED_TRANSFORMATION_OPERATIONS — Lista blanca de operaciones permitidas en data-transformation.
 *
 * QUÉ ES:
 *   Operaciones que el usuario puede solicitar en la herramienta de transformación
 *   de datos. Se inyectan en el system prompt de data-transformation.ts para
 *   que el modelo rechace cualquier instrucción fuera de esta lista.
 *
 * POR QUÉ UNA LISTA BLANCA (no negra):
 *   Es más seguro especificar qué SÍ está permitido que intentar bloquear
 *   lo que NO está permitido. Un atacante podría encontrar operaciones dañinas
 *   no contempladas en una lista negra. La lista blanca garantiza un conjunto
 *   finito y controlado de acciones posibles.
 *
 * RELACIÓN CON data-transformation.ts:
 *   La Server Action importa `ALLOWED_OPERATIONS` desde las constantes de la feature.
 *   Este array es la fuente de verdad compartida entre la validación del backend
 *   y la interfaz de usuario que muestra las opciones disponibles.
 */
export const ALLOWED_TRANSFORMATION_OPERATIONS = [
  'renombrar-campo', // Cambiar el nombre de una columna/propiedad
  'convertir-tipo', // Cambiar el tipo de dato (string → number, etc.)
  'combinar-campos', // Fusionar dos columnas en una
  'dividir-campo', // Separar un campo en múltiples columnas
  'filtrar-registros', // Eliminar filas según condición
  'ordenar-registros', // Ordenar por uno o más campos
  'agregar-campo', // Añadir una nueva columna calculada
  'eliminar-campo', // Remover una columna completa
  'calcular-campo', // Derivar un campo a partir de una fórmula
] as const;

/** Tipo TypeScript para validar que una operación sea de las permitidas */
export type TransformationOperation = (typeof ALLOWED_TRANSFORMATION_OPERATIONS)[number];
