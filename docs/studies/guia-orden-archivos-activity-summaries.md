# Activity Summaries - Guía de Orden de Archivos

**Propósito:** Esta guía explica el orden exacto en que los archivos se llaman entre sí durante el proceso de generación de un resumen. Creada a partir del feedback del equipo sobre dificultad para encontrar el orden entre archivos.

---

## Mapa Completo de Archivos (17 archivos)

```
📁 Orden de lectura recomendado (de arriba a abajo):

 ①  app/tools/activity-summaries/page.tsx          ← PUNTO DE ENTRADA (la URL)
                    │
 ②  app/components/features/ai-tools/activity-summary/
    │   ├── activity-summary.tsx                   ← ORQUESTADOR (maneja todo)
    │   ├── activity-summary-form.tsx              ← FORMULARIO (input del usuario)
    │   ├── activity-summary-preview.tsx           ← PREVIEW (muestra resultado)
    │   ├── activity-summary-list.tsx              ← LISTA (templates guardados)
    │   ├── types.ts                               ← TIPOS (TypeScript types)
    │   ├── constants.ts                           ← CONSTANTES (estilos, límites)
    │   └── index.ts                               ← BARREL EXPORT
    │
 ③  app/components/features/ai-tools/activity-summary/hooks/
    │   ├── use-summary-generator.ts               ← HOOK GENERACIÓN (llama al servicio)
    │   ├── use-summary-templates.ts               ← HOOK TEMPLATES (localStorage)
    │   └── index.ts                               ← BARREL EXPORT
    │
 ④  app/actions/activity-summary.ts                ← SERVER ACTION (puente)
                    │
 ⑤  app/lib/services/activity-summary-ai-service.ts ← SERVICIO IA (lógica principal)
    app/lib/schemas/activity-summary.schema.ts      ← SCHEMAS ZOD (validación)
    app/config/prompts/activity-summary-generation.ts ← PROMPTS (instrucciones IA)
```

---

## Flujo Paso a Paso: ¿Qué sucede cuando el usuario genera un resumen?

### Paso 1: El usuario abre la página

```
ARCHIVO: app/tools/activity-summaries/page.tsx

¿Qué hace?
- Define la ruta /tools/activity-summaries
- Define el título y descripción SEO (metadata)
- Renderiza el componente <ActivitySummary />
- Es un Server Component (sin 'use client')

Código clave:
  export default function ActivitySummariesPage() {
    return <ActivitySummary />;
  }
```

### Paso 2: Se carga el componente orquestador

```
ARCHIVO: app/components/features/ai-tools/activity-summary/activity-summary.tsx

¿Qué hace?
- Es 'use client' (componente de cliente)
- Define los campos del formulario (formFields)
- Maneja los estados: generación, historial, preview
- Contiene las funciones: handleGenerate, handleAccept, handleReject, etc.
- Renderiza los 3 sub-componentes según el estado

Funciones importantes:
  handleGenerate()  → Llama al Server Action para generar
  handleAccept()    → Guarda en historial
  handleReject()    → Descarta resultado
  handleRegenerate() → Vuelve a generar

Usa el shared component <AIToolPage> de:
  app/components/features/ai-tools/shared/
```

### Paso 3: El usuario llena el formulario

```
ARCHIVO: app/components/features/ai-tools/activity-summary/activity-summary-form.tsx

¿Qué hace?
- Renderiza los campos: Tipo Activo, Tipo Tarea, Actividades, Estilo, Detalle
- Valida que las actividades tengan entre 50-5000 caracteres
- Muestra contador de caracteres
- Al presionar "Generar Resumen con IA" llama a handleGenerate()

Usa:
  - constants.ts → SUMMARY_STYLES, DETAIL_LEVELS, SUMMARY_LIMITS
  - hooks/use-summary-generator.ts → { isGenerating, generate }
  - @/app/constants/ai → ASSET_TYPES, TASK_TYPES
```

### Paso 4: El hook llama al servicio de IA

```
ARCHIVO: app/components/features/ai-tools/activity-summary/hooks/use-summary-generator.ts

¿Qué hace?
- Maneja el estado de la generación (isGenerating, summary, error, progress)
- Crea un singleton del ActivitySummaryAIService
- La función generate():
    1. Pone isGenerating = true
    2. Simula progreso (10% → 30% → 90% → 100%)
    3. Llama a service.generateSummary(request)
    4. Si success → guarda summary en estado
    5. Si error → guarda error en estado

⚠️ NOTA: Este hook instancia el servicio directamente.
Sin embargo, el componente principal (activity-summary.tsx) usa
el Server Action como alternativa (ver Paso 5).
```

### Paso 5: El Server Action actúa como puente

```
ARCHIVO: app/actions/activity-summary.ts

¿Qué hace?
- Tiene la directiva 'use server' (se ejecuta en el servidor)
- Instancia ActivitySummaryAIService
- Expone la función generateActivitySummary()
- Actúa como PUENTE: el cliente no puede importar el servicio
  directamente porque usa variables de entorno del servidor (GROQ_API_KEY)

Código completo (solo 15 líneas):
  'use server';
  const summaryService = new ActivitySummaryAIService();

  export async function generateActivitySummary(request) {
    return summaryService.generateSummary(request);
  }
```

### Paso 6: El servicio genera el resumen con IA

````
ARCHIVO: app/lib/services/activity-summary-ai-service.ts

¿Qué hace? (Este es el archivo MÁS IMPORTANTE)
- Hereda de BaseAIService (retry, cache, logging)
- Configura GROQ con la API key
- generateSummary():
    1. Valida input con Zod schema
    2. Verifica caché (evita regenerar lo mismo)
    3. Si no hay caché → llama a callAI()
    4. Guarda resultado en caché
    5. Retorna { success: true, summary }

- callAI():
    1. Obtiene el modelo de AI_TASK_MODELS.CHAT
    2. Construye el prompt con buildSummaryPrompt()
    3. Llama a GROQ con generateText() del AI SDK
    4. Parsea la respuesta JSON con parseAIResponse()
    5. Construye el objeto ActivitySummary completo
    6. Calcula wordCount y readingTime

- parseAIResponse():
    1. Limpia la respuesta (remueve markdown ```json```)
    2. Parsea el JSON
    3. Valida con aiSummaryResponseSchema (Zod)

Usa:
  - activity-summary.schema.ts → Validación de input y output
  - activity-summary-generation.ts → Prompts para la IA
  - base-ai-service.ts → Retry, cache, logging
  - @ai-sdk/groq → Cliente GROQ
  - ai (Vercel AI SDK) → generateText()
````

### Paso 7: Los schemas validan todo

```
ARCHIVO: app/lib/schemas/activity-summary.schema.ts

¿Qué hace?
- Define los schemas Zod para validar datos en AMBAS direcciones

Schemas:
  activitySummaryRequestSchema → Valida lo que envía el usuario
    - assetType: enum de tipos de activo
    - taskType: enum de tipos de tarea
    - activities: string 10-5000 chars
    - style: 'ejecutivo' | 'tecnico' | 'narrativo'
    - detailLevel: 'alto' | 'medio' | 'bajo'
    - context: string opcional max 500

  aiSummaryResponseSchema → Valida lo que responde la IA
    - title: string 1-150
    - executive: string 50-1000
    - sections: array de { title, content, order }

  activitySummarySchema → Valida el resumen completo final
    - Incluye id, metadata, fechas, etc.

Tipos exportados:
  ActivitySummaryRequest, ActivitySummary, SummarySection, AISummaryResponse
```

### Paso 8: Los prompts instruyen a la IA

```
ARCHIVO: app/config/prompts/activity-summary-generation.ts

¿Qué hace?
- Define SUMMARY_SYSTEM_PROMPT: instrucciones base para la IA
  (experto redactor técnico, reglas de formato JSON)

- getStyleSpecificInstructions(): instrucciones por estilo
  - Ejecutivo → resultados y métricas
  - Técnico → detalles y procedimientos
  - Narrativo → cronología y contexto

- getDetailLevelInstructions(): instrucciones por nivel
  - Alto → 4-6 secciones, 2 párrafos ejecutivo
  - Medio → 3-4 secciones, 1-2 párrafos
  - Bajo → 2-3 secciones, 1 párrafo

- buildSummaryPrompt(): construye el prompt final combinando todo

- SUMMARY_RETRY_PROMPT: prompt de reintento si el JSON es inválido
```

### Paso 9: El resultado se muestra en preview

```
ARCHIVO: app/components/features/ai-tools/activity-summary/activity-summary-preview.tsx

¿Qué hace?
- Muestra el resumen generado en un modal overlay
- Header: título, wordCount, readingTime, estilo
- Body: resumen ejecutivo + secciones ordenadas
- Footer: botones Cerrar, Copiar, Guardar

Cuando el usuario presiona "Guardar" → se guarda como template
```

### Paso 10: Templates guardados se muestran en lista

```
ARCHIVO: app/components/features/ai-tools/activity-summary/activity-summary-list.tsx

¿Qué hace?
- Muestra templates guardados previamente
- Usa el hook useSummaryTemplates (localStorage)
- Cada template muestra: nombre, estilo, nivel, veces usado
- Click en template → lo selecciona para reutilizar
```

---

## Diagrama de Llamadas (quién llama a quién)

```
page.tsx
  └→ activity-summary.tsx (orquestador)
       ├→ activity-summary-form.tsx (UI input)
       │    └→ hooks/use-summary-generator.ts (estado)
       │         └→ activity-summary-ai-service.ts (IA)
       │              ├→ activity-summary.schema.ts (validación)
       │              └→ activity-summary-generation.ts (prompts)
       │                   └→ GROQ API (Llama 3.3 70B)
       │
       ├→ activity-summary-preview.tsx (UI output)
       │
       └→ activity-summary-list.tsx (historial)
            └→ hooks/use-summary-templates.ts (localStorage)
```

---

## Archivos de Soporte (no participan en el flujo principal)

| Archivo          | Propósito                                                   |
| ---------------- | ----------------------------------------------------------- |
| `types.ts`       | Re-exporta tipos del schema + tipos de UI (SummaryTemplate) |
| `constants.ts`   | Estilos, niveles, límites, mensajes UI, claves localStorage |
| `index.ts`       | Barrel export de componentes, hooks, types, constants       |
| `hooks/index.ts` | Barrel export de hooks                                      |

---

## Resumen: Orden de Lectura Recomendado

Para entender esta feature de principio a fin:

1. **`page.tsx`** — Punto de entrada (3 líneas útiles)
2. **`activity-summary.tsx`** — Orquestador (cómo se conecta todo)
3. **`types.ts` + `constants.ts`** — Qué tipos y constantes existen
4. **`activity-summary-form.tsx`** — Cómo se captura el input
5. **`hooks/use-summary-generator.ts`** — Cómo se maneja el estado
6. **`actions/activity-summary.ts`** — El puente (15 líneas)
7. **`activity-summary-ai-service.ts`** — **EL MÁS IMPORTANTE** - toda la lógica
8. **`activity-summary.schema.ts`** — Validación de entrada y salida
9. **`activity-summary-generation.ts`** — Prompts para la IA
10. **`activity-summary-preview.tsx`** — Cómo se muestra el resultado
11. **`activity-summary-list.tsx`** + **`use-summary-templates.ts`** — Persistencia

---

**Última actualización:** 2026-02-24  
**Creado por:** Jose Miserol  
**Feedback atendido:** Aaron Carreño - "no pude encontrar un orden entre los archivos"
