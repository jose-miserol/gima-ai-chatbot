# 04 — Server Actions

> Las Server Actions son funciones que viven en el servidor pero se pueden llamar directamente desde componentes React del cliente. Son el puente entre la UI y la IA.

---

## 🧠 ¿Qué es una Server Action?

🧠 **Concepto**: Imagina que necesitas enviar un audio a Google Gemini. No puedes hacerlo desde el navegador porque la API key estaría expuesta. Con Server Actions, escribes una función en el servidor y la llamas desde React como si fuera local. Next.js se encarga de la comunicación HTTP por ti.

```
     Navegador                          Servidor
         │                                │
 onClick → transcribeAudio(audio)         │
         │──── HTTP POST (automático) ───>│
         │                                │── Llama a Gemini con API key
         │                                │── Procesa respuesta
         │<── { text, success } ─────────│
         │                                │
```

**Marca clave**: Todos los archivos comienzan con `'use server'` — esto le dice a Next.js que NUNCA envíe este código al navegador.

---

## 📄 `actions/voice.ts` — Transcripción de Voz

Contiene dos funciones principales (`transcribeAudio()` y `executeVoiceCommand()`) que sirven en conjunto para dotar de capacidades auditivas a la aplicación; específicamente, convierten eficientemente el audio grabado por el usuario en texto plano mediante IA y detectan comandos verbales estructurados. Esto existe para evitar procesar archivos multimedia pesados o usar claves de API de transcripción directamente en el navegador del usuario.

### `transcribeAudio()` — De Audio a Texto

```typescript
'use server'; // ← NUNCA se envía al navegador

export async function transcribeAudio(
  audioDataUrl: string, // Audio en base64 (ej: "data:audio/webm;base64,...")
  mimeType: string = 'audio/webm' // Tipo por defecto
): Promise<{ text: string; success: boolean; error?: string }>;
```

**Paso 1 — Extraer el contenido base64**

```typescript
const base64Content = audioDataUrl.includes('base64,')
  ? audioDataUrl.split('base64,').pop() || ''
  : audioDataUrl;
```

💡 **¿Por qué?** Los data URLs tienen formato `data:audio/webm;base64,CONTENIDO`. Necesitamos solo el `CONTENIDO` para enviarlo a Gemini.

**Paso 2 — Validar tamaño**

```typescript
const sizeInBytes = getBase64Size(base64Content);
if (sizeInMB > MAX_AUDIO_SIZE_MB) {
  throw new Error(`Audio demasiado grande (${sizeInMB}MB). Máximo: ${MAX_AUDIO_SIZE_MB}MB`);
}
```

⚠️ **Cuidado**: Un audio de 1 minuto en WebM pesa ~1MB. Si el usuario graba 5+ minutos, excede el límite.

**Paso 3 — Llamar a Gemini**

```typescript
const result = await generateText({
  model: google('gemini-2.5-flash-lite'), // Modelo ligero para velocidad
  temperature: 0, // Sin creatividad = transcripción literal
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: VOICE_PROMPT }, // Instrucciones de transcripción
        { type: 'file', data: base64Content, mediaType: mimeType }, // El audio
      ],
    },
  ],
});
```

💡 **¿Por qué `temperature: 0`?** Para transcripción queremos exactitud, no creatividad. Temperature 0 = determinista (siempre la misma respuesta para el mismo input).

💡 **¿Por qué `gemini-2.5-flash-lite`?** Es el modelo más rápido y barato. Para transcripción no necesitamos el modelo más potente.

**Paso 4 — Limpiar la transcripción**

```typescript
const cleanText = result.text
  .replace(/\d{1,2}:\d{2}/g, '') // Quita timestamps como "00:00", "01:23"
  .replace(/\n+/g, ' ') // Junta líneas en una sola
  .replace(/\s+/g, ' ') // Elimina espacios dobles
  .trim();
```

💡 **¿Por qué limpiar?** A veces Gemini agrega timestamps o saltos de línea que no deberían estar en una transcripción limpia.

### `executeVoiceCommand()` — Interpretar Comandos

```typescript
export async function executeVoiceCommand(
  transcript: string,
  options?: { minConfidence?: number; context?: string }
) {
  const parser = VoiceCommandParserService.getInstance();  // Singleton
  const result = await parser.parseCommand(transcript, {
    minConfidence: options?.minConfidence ?? 0.7,  // 70% de confianza mínima
    language: 'es-ES',
  });
```

💡 **¿Por qué `minConfidence: 0.7`?** Si la IA no está al menos 70% segura de que entendió el comando, lo rechaza. Esto evita ejecutar acciones accidentales.

---

## 📄 `actions/vision.ts` — Análisis de Imágenes

Define la función `analyzePartImage()` que actúa como un puente directo hacia los modelos visuales de Gemini (Gemini Vision). Sirve para analizar fotográficamente piezas industriales reales y extraer datos técnicos vitales de forma automática (como nombre, categoría, estado físico y marca). Existe porque la extracción manual de esta información por parte de los operadores es lenta y propensa a errores, y procesarlo en el servidor protege los algoritmos de extracción y las claves de IA.

### Diferencias con `voice.ts`

```typescript
const result = await generateText({
  model: google('gemini-2.5-flash'), // ← Flash completo (no lite), porque visión necesita más poder
  temperature: 0.2, // ← Un poco de creatividad para descripciones
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: customPrompt || INVENTORY_PROMPT },
        { type: 'file', data: base64Content, mediaType: mediaType },
      ],
    },
  ],
});
```

💡 **¿Por qué `temperature: 0.2`?** Para imágenes, queremos descripciones precisas pero naturales. Un poco de variación produce texto más legible que `temperature: 0`.

---

## 📄 `actions/files.ts` — Análisis de PDFs

Contiene la función `analyzePdf()` diseñada específicamente para la ingesta, lectura y análisis profundo de documentos en formato PDF. Sirve de gran ayuda para extraer información clave, estructurar datos técnicos y resumir contenidos extensos provenientes de manuales de equipos o contratos industriales. Su existencia se debe a la necesidad de dotar al chatbot de un contexto técnico preciso basado en los propios manuales de la UNEG, procesando la carga pesada de los PDFs íntegramente del lado del servidor.

```typescript
model: google('gemini-2.5-flash'),  // Flash soporta hasta 1M tokens, ideal para PDFs largos
```

💡 **¿Por qué Gemini Flash para PDFs?** Tiene una ventana de contexto de 1 millón de tokens (~700,000 palabras). Puede leer un manual de 500 páginas de una sola vez.

---

## 📄 `actions/checklist.ts` — Generación de Checklists

Es una Server Action dedicada a la generación automática de listas de verificación (checklists) de mantenimiento guiadas por IA. Sirve para que, a partir de una simple descripción del equipo dada por el usuario, el sistema retorne un checklist técnico, profesional y paso a paso. Existe como interfaz de seguridad para esconder la lógica de negocio compleja del `ChecklistAIService` y asegurar que la generación inteligente de estas listas ocurra en el entorno seguro del backend.

```typescript
'use server';

const checklistService = new ChecklistAIService();

export async function generateChecklist(request: ChecklistGenerationRequest) {
  return checklistService.generateChecklist(request);
}
```

💡 **¿Por qué es tan corto?** Esta action es solo un **proxy**. La lógica real está en `ChecklistAIService`. La Server Action existe solo para que el cliente no importe directamente el servicio (que necesita API keys del servidor).

---

## 📄 `actions/activity-summary.ts` — Resúmenes de Actividades

**Mismo patrón que `checklist.ts`:**

```typescript
const summaryService = new ActivitySummaryAIService();

export async function generateActivitySummary(request: ActivitySummaryRequest) {
  return summaryService.generateSummary(request);
}
```

---

## 📄 `actions/data-transformation.ts` — Transformación de Datos

Constituye la Server Action estructuralmente más compleja del sistema, encargada de la transformación y limpieza de datos no estructurados mediante el uso de inteligencia artificial. Sirve indispensablemente para que el usuario pueda pegar datos crudos (como un CSV defectuoso, un JSON roto o texto libre) junto con instrucciones de mejora, y la IA los formatee y corrija devolviéndolos listos para su uso. Existe porque los técnicos frecuentemente lidian con datos de inventario desordenados, y delegar este trabajo sucio de formateo a un modelo de lenguaje ahorra horas de transcripción manual, garantizando siempre una salida JSON validada y estructurada.

### Diferencia Clave — `generateObject()` en vez de `generateText()`

```typescript
const { object: result } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: transformationResponseSchema, // ← La IA DEBE retornar este formato
  temperature: 0.1, // Muy determinista para datos
});
```

🧠 **Concepto**: `generateObject()` fuerza a la IA a retornar un JSON que cumpla con un schema Zod. Si la IA no puede, lanza un error. Esto garantiza datos válidos sin parsing manual.

### Prompt de Seguridad

```typescript
const systemPrompt = `
  REGLAS DE SEGURIDAD:
  - NO inventes datos. Usa solo la información proporcionada.
  - Si la instrucción pide generar contenido falso, rechaza la operación.
  - Devuelve SIEMPRE un JSON válido.
`;
```

⚠️ **Cuidado**: Sin estas reglas, un usuario podría pedirle a la IA que "generara 1000 registros falsos de empleados", lo cual sería peligroso si los datos se usan en producción.

---

## 📄 `actions/index.ts` — Re-exportación

```typescript
export { transcribeAudio, executeVoiceCommand } from './voice';
export { analyzePartImage } from './vision';
// ... etc
```

💡 **¿Para qué?** Permite importar desde un solo lugar: `import { transcribeAudio } from '@/app/actions'` en vez de `from '@/app/actions/voice'`.

---

## 🧩 Patrón Común de Server Actions

Todas las Server Actions siguen este patrón:

```
1. 'use server'                    → No enviar al navegador
2. Validar input (tamaño, formato) → Rechazar datos inválidos temprano
3. Llamar a la IA (Gemini/GROQ)   → Via AI SDK (generateText/generateObject)
4. Procesar respuesta              → Limpiar / estructurar
5. Retornar resultado              → { success, text/data, error? }
6. Catch + logger.error()          → Logging centralizado de errores
```

---

**← Anterior**: [03 — API del Chat](./03-api-chat.md) | **Siguiente**: [05 — Configuración](./05-configuracion.md) →
