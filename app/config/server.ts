/**
 * @file server.ts
 * @module app/config/server
 *
 * ============================================================
 * CONFIGURACIÓN DEL SERVIDOR — PROMPTS, GLOSARIO Y STREAM
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Centraliza toda la configuración que SOLO existe en el servidor:
 *   los prompts del sistema de IA, el glosario técnico de la UNEG y
 *   la configuración de streaming. Todo lo que aquí se define moldea
 *   el comportamiento e identidad del chatbot GIMA.
 *
 * POR QUÉ "server.ts" Y NO "prompts.ts":
 *   Este archivo contiene configuración sensible que NO debe llegar al bundle
 *   del cliente: los prompts del sistema revelan las instrucciones internas.
 *   por seguridad no se exponen.
 *   Al nombrarlo "server" y no importarlo desde componentes cliente,
 *   Next.js lo mantiene exclusivamente en el servidor.
 *
 * ARQUITECTURA DE PROMPTS EN GIMA:
 * SYSTEM_PROMPT     → Identidad del asistente
 * VOICE_PROMPT      → Motor de transcripción
 * INVENTORY_PROMPT  → Auditor de visión
 * STREAM_CONFIG     → Parámetros del streaming
 *
 * Todos usan `formatGlossary()` para inyectar terminología UNEG.
 *
 * DÓNDE SE IMPORTAN:
 *   - SYSTEM_PROMPT    → app/lib/services/chat-service.ts
 *   - VOICE_PROMPT     → app/actions/voice.ts
 *   - INVENTORY_PROMPT → app/actions/vision.ts
 *   - STREAM_CONFIG    → app/api/chat/route.ts
 */

// ============================================================
// GLOSARIO DE TÉRMINOS TÉCNICOS
// ============================================================

/**
 * ACRONYMS_GLOSSARY — Mapeo de siglas y términos técnicos de la UNEG.
 *
 * QUÉ ES:
 *   Diccionario de acrónimos y términos específicos del contexto de
 *   mantenimiento de la Universidad Nacional Experimental de Guayana.
 *
 * POR QUÉ EXISTE:
 *   Los técnicos de GIMA hablan en siglas: "La UMA del edificio 3 falló"
 *   o "Revisar el BCA del sótano". Sin este glosario, el modelo de IA
 *   no sabría que "UMA" es una Unidad Manejadora de Aire y daría respuestas
 *   genéricas o incorrectas.
 *
 * CÓMO SE USA:
 *   Se inyecta en todos los prompts del sistema vía `formatGlossary()`.
 *   Esto le dice al modelo: "cuando el usuario diga X, entiende que se
 *   refiere a Y en el contexto de mantenimiento de la UNEG".
 *
 * CÓMO AGREGAR NUEVOS TÉRMINOS:
 *   Agregar una nueva entrada al objeto. El cambio se propagará automáticamente
 *   a todos los prompts en el siguiente deploy.
 */
const ACRONYMS_GLOSSARY: Record<string, string> = {
  UNEG: 'Universidad Nacional Experimental de Guayana',
  UMA: 'Unidad Manejadora de Aire', // Equipos HVAC centrales
  BCA: 'Bomba Centrífuga de Agua', // Bombas del sistema hidráulico
  TAB: 'Tablero de Distribución Eléctrica', // Paneles eléctricos
  ST: 'Subestación Transformadora', // Transformadores de alta tensión
  AA: 'Aire Acondicionado (Split/Ventana)', // Unidades de A/C individuales
  GIMA: 'Gestión Integral de Mantenimiento y Activos', // El propio sistema
  OT: 'Orden de Trabajo', // Ticket de tarea de mantenimiento
  MP: 'Mantenimiento Preventivo', // Mantenimiento programado
  MC: 'Mantenimiento Correctivo', // Mantenimiento por falla
};

/**
 * formatGlossary — Formatea el glosario para inserción en prompts de IA.
 *
 * QUÉ HACE:
 *   Convierte el objeto `ACRONYMS_GLOSSARY` en una lista Markdown con
 *   formato `- **SIGLA**: Definición completa` lista para inyectarse
 *   en cualquier prompt de sistema.
 *
 * POR QUÉ MARKDOWN EN LOS PROMPTS:
 *   Los LLMs modernos (Llama, Gemini) están entrenados con texto Markdown
 *   y responden mejor a prompts estructurados con énfasis (**negrita**).
 *   El `**SIGLA**` en negrita hace que el modelo priorice esos términos
 *   al interpretar el input del usuario.
 *
 * @returns String multilínea con todas las definiciones del glosario.
 */
export const formatGlossary = (): string => {
  return Object.entries(ACRONYMS_GLOSSARY)
    .map(([acronym, meaning]) => `- **${acronym}**: ${meaning}`)
    .join('\n');
};

// ============================================================
// SYSTEM PROMPT — IDENTIDAD DEL ASISTENTE GIMA
// ============================================================

/**
 * SYSTEM_PROMPT — Prompt principal que define la personalidad y reglas del chatbot.
 *
 * QUÉ ES:
 *   El "contrato de comportamiento" del asistente. Es el primer mensaje que
 *   el modelo recibe en cada conversación y establece:
 *   - Quién es (experto en gestión de mantenimiento de la UNEG)
 *   - Qué puede hacer (consultar activos, OTs, inventario, etc.)
 *   - Cómo debe responder (técnico pero claro, con pasos numerados)
 *   - Qué NO debe hacer (inventar datos, ignorar el glosario)
 *   - Cómo usar las herramientas disponibles (tool calls al backend GIMA)
 *
 * REGLAS CRÍTICAS DOCUMENTADAS (referenciadas por número en el prompt):
 *
 *   Regla 7-8: Usar herramientas para datos reales.
 *     Por qué: Los LLMs "alucinan" datos de activos si no tienen contexto real.
 *     El modelo DEBE llamar a las herramientas del backend en lugar de inventar.
 *
 *   Regla 9: consultar_activos sin parámetro `tipo` para listados generales.
 *     Por qué: Evita que el modelo filtre accidentalmente los resultados cuando
 *     el usuario quiere ver todos los activos.
 *
 *   Regla 10: NO repetir datos de herramientas como tablas Markdown.
 *     Por qué: El sistema frontend ya renderiza los resultados de tool calls
 *     en tablas interactivas. Si el modelo también los escribe como Markdown,
 *     la información aparecería duplicada en la UI.
 *
 *   Regla 14: Mapeo de lenguaje natural a tipos de activo.
 *     Por qué: Los técnicos dicen "el aire acondicionado" pero la API del backend
 *     espera "hvac". El modelo debe hacer esta traducción internamente.
 *
 *   Regla 15: Confirmar detalles antes de crear órdenes de trabajo.
 *     Por qué: Crear una OT incorrecta genera trabajo adicional para corregirla.
 *     El modelo debe ser conservador y confirmar antes de ejecutar acciones.
 *
 * CÓMO SE USA:
 *   Se inyecta como `system` en la llamada a streamText() en ChatService.
 *   El glosario se incluye dinámicamente vía `${formatGlossary()}`.
 */
export const SYSTEM_PROMPT = `Eres un asistente experto en gestión de mantenimiento y activos para la Universidad Nacional Experimental de Guayana (UNEG).

Tu objetivo es ayudar a técnicos, ingenieros y personal de mantenimiento con:
- Consultas sobre equipos y su estado
- Procedimientos de mantenimiento preventivo y correctivo
- Interpretación de manuales técnicos
- Diagnóstico de fallas comunes
- Recomendaciones de repuestos

CONTEXTO DE TERMINOLOGÍA Y SIGLAS (IMPORTANTE):
La universidad utiliza códigos y siglas específicas. Úsalas para interpretar las consultas de los usuarios y expandirlas cuando sea necesario para mayor claridad:

${formatGlossary()}

Directrices:
1. Sé preciso y técnico, pero claro
2. Si un usuario usa una sigla del glosario (ej: "Falla en la UMA"), entiende a qué equipo se refiere
3. Si no estás seguro, admítelo y sugiere consultar un manual
4. Prioriza la seguridad en todas las recomendaciones
5. Usa terminología técnica apropiada
6. Proporciona pasos claros y numerados cuando sea necesario
7. Cuando el usuario pregunte sobre activos, mantenimientos, inventario o datos del sistema, usa las herramientas disponibles para consultar datos reales del backend GIMA
8. No inventes datos de activos, mantenimientos ni inventario — consulta siempre con las herramientas
9. MUY IMPORTANTE: Usa la herramienta \`consultar_activos\` para CUALQUIER consulta de equipos o activos. Si el usuario pide listados generales, no incluyas el parámetro \`tipo\`. Si el usuario especifica una categoría (ej. mobiliario o equipos), usa el parámetro \`tipo\` con el valor correspondiente ("mobiliario" o "equipo").
10. MUY IMPORTANTE: NO repitas la información devuelta por las herramientas en tu respuesta de texto (como tablas de Markdown o listas detalladas), ya que el sistema mostrará automáticamente el resultado en una tabla interactiva. 
11. Para consultas de repuestos o piezas con stock bajo (agotándose), usa siempre la herramienta \`consultar_inventario\` con el parámetro \`bajo_stock: true\`.
12. Para consultas de mantenimientos pendientes o en progreso, usa la herramienta \`consultar_mantenimientos\` con el parámetro \`estado\` correspondiente ("pendiente" o "en_progreso").
13. Para crear órdenes de trabajo, confirma los detalles con el usuario antes de ejecutar

CAPACIDADES DISPONIBLES (responde con esta lista si preguntan "¿Qué puedes hacer?" o "¿En qué puedes ayudarme?"):
- Consultar activos.
- Consultar órdenes de mantenimiento.
- Consultar reportes de fallos e incidencias.
- Buscar repuestos en inventario (stock, alertas de bajo stock)
- Generar checklists de mantenimiento con IA.
- Generar resúmenes de actividad técnica con IA.
- Analizar imágenes de piezas y equipos con visión por IA
- Analizar documentos PDF

REGLAS DE MAPEO DE PARÁMETROS:
14. Cuando uses herramientas que requieren un tipo de activo (assetType), mapea el lenguaje natural del usuario al valor más cercano de esta lista: hvac, bomba, caldera, tablero, generador, compresor, motor, transformador. Ejemplos: "Test de Aire" → "hvac", "Bomba de Agua" → "bomba", "Panel eléctrico" → "tablero". Si no hay coincidencia clara, usa el texto original del usuario.
15. Antes de crear una orden de trabajo, SIEMPRE identifica el equipo, descripción y prioridad de la conversación. Si el usuario no los menciona explícitamente, pregúntale.

Contexto General: La UNEG está digitalizando su sistema de mantenimiento. Actualmente muchos procesos son manuales.`;

// ============================================================
// VOICE PROMPT — MOTOR DE TRANSCRIPCIÓN ESTRICTA
// ============================================================

/**
 * VOICE_PROMPT — Prompt para el modelo de transcripción de audio Gemini Flash Lite.
 *
 * QUÉ ES:
 *   Instrucciones para que Gemini actúe como una "máquina de transcripción"
 *   pura, sin añadir ni interpretar nada. Prioriza la fidelidad literal
 *   sobre la corrección gramatical.
 *
 * POR QUÉ TAN ESTRICTO (regla 2):
 *   Los técnicos frecuentemente hacen "pruebas de micrófono" diciendo
 *   "Probando, 1 2 3" antes de su comando real. Sin la regla explícita
 *   de transcribir literalmente, el modelo podría filtrar estos textos
 *   de prueba pensando que son ruido, interrumpiendo el flujo del usuario.
 *
 * POR QUÉ NO INCLUIR timestamps (regla 4):
 *   El modelo base de Gemini, cuando analiza audio, tiende a incluir
 *   marcas de tiempo como "[00:00] texto [00:05] más texto". Estos
 *   timestamps rompen el parsing de comandos en executeVoiceCommand().
 *   La regla 4 + la limpieza por código en voice.ts son capas de defensa
 *   redundantes para garantizar texto limpio.
 *
 * POR QUÉ SE INYECTA EL GLOSARIO:
 *   Los técnicos pronuncian las siglas fonéticamente ("u-m-a", "be-ca").
 *   Al darle el glosario al modelo, puede mapear "ube eme a" → "UMA"
 *   con mayor precisión que sin contexto.
 *
 * USADO EN: app/actions/voice.ts → transcribeAudio()
 */
export const VOICE_PROMPT = `Actúa como una máquina de transcripción estricta para el sistema GIMA.
Tu ÚNICA función es convertir el audio en texto, palabra por palabra.

REGLAS DE ORO:
1. Escribe EXACTAMENTE lo que escuchas.
2. IMPORTANTE: Si el usuario dice palabras cortas de verificación (ej: "Prueba", "Test", "Probando", "1 2 3"), TRANSCRÍBELAS LITERALMENTE. No las filtres.
3. NO inventes, NO completes frases.
4. NO incluyas marcas de tiempo ni descripciones de ruido (ej: [silencio]).

TERMINOLOGÍA TÉCNICA:
Si y SOLO SI escuchas términos que coincidan fonéticamente con estas siglas, úsalas en mayúsculas:

${formatGlossary()}

Si el audio no es claro, escribe lo que mejor entiendas fonéticamente.`;

// ============================================================
// INVENTORY PROMPT — AUDITOR DE VISIÓN PARA PIEZAS INDUSTRIALES
// ============================================================

/**
 * INVENTORY_PROMPT — Prompt para el análisis de imágenes de piezas con Gemini Vision.
 *
 * QUÉ ES:
 *   Instrucciones para que Gemini actúe como un "Auditor de Inventario Experto"
 *   que extrae datos técnicos estructurados de fotografías de piezas.
 *
 * POR QUÉ PIDE JSON + RESUMEN (formato dual):
 *   - El JSON es procesado por el código (vision.ts usa generateObject con Zod).
 *   - El resumen en español es mostrado al usuario como texto explicativo.
 *   Esto permite que la misma respuesta sirva tanto para la UI como para
 *   el sistema de inventario backend.
 *
 * NOTA SOBRE LA RELACIÓN CON EL SCHEMA ZOD EN vision.ts:
 *   Este prompt describe el formato de salida en texto natural.
 *   El schema Zod en vision.ts es la validación técnica de ese mismo formato.
 *   Ambos deben mantenerse sincronizados: si se agrega un campo al schema Zod,
 *   también debe documentarse en este prompt para que el modelo lo genere.
 *
 * USADO EN: app/actions/vision.ts → analyzePartImage() (como fallback cuando
 *           el usuario no proporciona un prompt personalizado)
 */
export const INVENTORY_PROMPT = `Eres un Auditor de Inventario Experto para el sistema GIMA de la UNEG.
Tu tarea es analizar fotografías de piezas industriales, repuestos o equipos y extraer datos técnicos precisos para el catálogo.

INSTRUCCIONES DE ANÁLISIS:
1. Identifica la pieza con su nombre técnico más preciso (evita nombres genéricos).
2. Clasifícala en una categoría (Ej: Hidráulica, Eléctrica, Herramientas, EPP, Mecánica, Electrónica).
3. Estima la cantidad visible en la foto.
4. Detecta el estado físico (Nuevo, Usado, Dañado, Requiere Inspección).
5. Extrae cualquier texto visible (Números de serie, marcas, especificaciones).
6. Si reconoces la marca o modelo, inclúyelo.

TERMINOLOGÍA TÉCNICA:
${formatGlossary()}

FORMATO DE SALIDA (IMPORTANTE):
Responde SIEMPRE con un bloque de código JSON válido seguido de un breve resumen en español.

Estructura JSON requerida:
\`\`\`json
{
  "item_name": "Nombre Técnico de la Pieza",
  "category": "Categoría",
  "quantity_detected": 1,
  "condition": "Nuevo/Usado/Dañado",
  "brand": "Marca (si visible)",
  "model": "Modelo (si visible)",
  "serial_number": "S/N (si visible)",
  "specs": ["especificación1", "especificación2"],
  "notes": "Observaciones adicionales",
  "confidence": "Alta/Media/Baja"
}
\`\`\`

Después del JSON, proporciona un resumen breve como: "He identificado un/una [nombre] en estado [condición]. Se recomienda [acción]."`;

// ============================================================
// STREAM CONFIG — PARÁMETROS DEL STREAMING DE IA
// ============================================================

/**
 * STREAM_CONFIG — Configuración del streaming de respuestas de IA.
 *
 * QUÉ ES:
 *   Objeto con los parámetros que controlan cómo se transmite la respuesta
 *   del modelo al cliente en el endpoint /api/chat.
 *
 * CAMPOS:
 *
 *   maxDuration (30s):
 *     Timeout interno de GIMA para el streaming. Diferente a `maxDuration` del
 *     route handler (60s) — este es el límite que ChatService aplica internamente.
 *     30s es suficiente para respuestas conversacionales. Para transformaciones
 *     de datos largas se usa el timeout del route handler (60s).
 *
 *   sendSources (false):
 *     No enviar las fuentes de búsqueda web en el stream al cliente.
 *     Razón: GIMA usa herramientas de backend (no búsqueda web), por lo que
 *     no hay "fuentes" relevantes para mostrar al usuario.
 *
 *   sendReasoning (false):
 *     No enviar el "chain of thought" interno del modelo al cliente.
 *     Razón: El razonamiento intermedio confunde a usuarios no técnicos
 *     y aumenta el uso de tokens en el stream. Se puede activar en modo debug.
 *
 * USADO EN: app/api/chat/route.ts → result.toUIMessageStreamResponse()
 */
export const STREAM_CONFIG = {
  maxDuration: 30, // segundos — timeout interno del stream de ChatService
  sendSources: false, // no incluir citaciones de búsqueda web en el stream SSE
  sendReasoning: false, // no incluir chain-of-thought del modelo en el stream SSE
};
