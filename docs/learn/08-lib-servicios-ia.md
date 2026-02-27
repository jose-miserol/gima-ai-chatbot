# 08 — Servicios de IA (`lib/ai/` y `lib/services/`)

> Aquí vive el "motor" del proyecto. Los servicios encapsulan toda la lógica de negocio: desde procesar un mensaje de chat hasta generar un checklist con IA.

---

## 📄 `lib/ai/base-ai-service.ts` — La Base de Todos los Servicios IA

Es una clase fundacional y abstracta de la cual heredan obligatoriamente todos los servicios específicos de inteligencia artificial del sistema. Sirve para proveer transparentemente y "gratis" un conjunto de funcionalidades vitales y transversales a cualquier servicio que la extienda, tales como reintentos automáticos (retries), almacenamiento en caché, validaciones integradas y manejo estricto de tiempos de espera (timeouts). Existe basada en el principio fundamental de no repetición de código (DRY); puesto que servicios distintos (como generadores de checklists o resúmenes) comparten idénticas necesidades lógicas de red, centralizarlas en una clase base previene la duplicación de código y estandariza el comportamiento general de la aplicación ante la IA.

### Arquitectura de Herencia

```
              BaseAIService (abstracta)
              ┌───────────────────────┐
              │ • retry con backoff   │
              │ • cache de respuestas │
              │ • validación Zod      │
              │ • timeout configurable│
              │ • logging estructurado│
              └───────┬───────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
ChecklistAI    ActivitySummaryAI  CloseoutAI
  Service          Service         Service
```

### Configuración Base

```typescript
interface AIServiceConfig {
  serviceName: string; // Nombre para logs (ej: "ChecklistService")
  timeoutMs?: number; // Timeout en ms (default: 30000)
  maxRetries?: number; // Reintentos máximos (default: 3)
  enableCaching?: boolean; // Habilitar cache (default: false)
  cacheTTL?: number; // Tiempo de vida del cache en ms
}
```

### Retry con Backoff Exponencial

```typescript
async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      return await fn();  // ← Intenta ejecutar
    } catch (error) {
      if (attempt === this.config.maxRetries) throw error;  // Sin más reintentos

      // Esperar con backoff: 1s, 2s, 4s...
      const delay = Math.pow(2, attempt) * 1000;
      await this.sleep(delay);
    }
  }
}
```

🧠 **Concepto**: **Backoff exponencial** = cada reintento espera más tiempo que el anterior. Intento 1: 1s, Intento 2: 2s, Intento 3: 4s. Esto evita saturar un servidor que está teniendo problemas.

### Errores Tipados

```typescript
class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly recoverable: boolean = false, // ← ¿Se puede reintentar?
  ) { ... }
}

class AITimeoutError extends AIServiceError {
  // recoverable = true → El retry lo reintentará
}

class AIValidationError extends AIServiceError {
  // recoverable = false → No tiene sentido reintentar datos inválidos
}
```

💡 **¿Por qué `recoverable`?** Un timeout puede funcionar en el segundo intento (el servidor se recuperó). Un error de validación NUNCA funcionará al reintentar (los datos siguen siendo inválidos).

---

## 📄 `lib/services/chat-service.ts` — Servicio del Chat

Constituye el servicio director que orquesta maestramente el flujo de vida completo de cada mensaje originado en el chat. Sirve como el eje central operativo que conecta y hace interactuar de manera secuencial y segura módulos dispares: llama al limitador de cuotas (rate limiter), somete el mensaje a la validación esquemática, invoca la sanitización contra inyecciones y, finalmente, establece y sostiene el conducto de streaming de texto continuo con la Inteligencia Artificial.

### Patrón de Inyección de Dependencias

```typescript
export class ChatService {
  private deps: ChatServiceDependencies;

  constructor(dependencies: Partial<ChatServiceDependencies> = {}) {
    this.deps = {
      logger: dependencies.logger || logger,              // Logger real o mock
      rateLimiter: dependencies.rateLimiter || chatRateLimiter,
      modelProvider: dependencies.modelProvider || createGroq({ apiKey: env.GROQ_API_KEY }),
    };
  }
```

💡 **¿Por qué inyección de dependencias?** Para testing. En un test, puedes pasar un `rateLimiter` falso que nunca bloquee, o un `modelProvider` que retorne respuestas predefinidas. Sin esto, los tests necesitarían API keys reales.

### Método Principal — `processMessage()`

```typescript
async processMessage(rawBody: unknown, clientIP: string | null) {
  // 1. Rate Limiting
  if (clientIP && !this.deps.rateLimiter.checkLimit(clientIP)) {
    throw new RateLimitError(retryAfter);
  }

  // 2. Validación con Zod
  const parseResult = chatRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.issues);
  }

  // 3. Sanitización (limpiar contenido peligroso)
  const messages = sanitizeForModel(rawMessages);

  // 4. Streaming de IA
  const result = streamText({
    model: this.deps.modelProvider(model),
    messages,
    system: SYSTEM_PROMPT,
    tools: chatTools,              // ← Herramientas que la IA puede invocar
    stopWhen: stepCountIs(5),      // ← Máximo 5 pasos de tool calling
  });

  return result;
}
```

💡 **¿Por qué `stopWhen: stepCountIs(5)`?** Evita que la IA entre en un loop infinito de tool calls. Si la IA llama a 5 herramientas y sigue sin terminar, paramos.

---

## 📄 `lib/ai/tools/chat-tools.ts` — Herramientas del Chat

Es el manifiesto programático que define y expone las herramientas interactivas (funciones o "Tool Calls") que la Inteligencia Artificial está autorizada a invocar de manera autónoma. Sirve para transformar a la IA de un mero generador pasivo de texto a un agente activo capaz de consultar bases de datos; por ejemplo, si el usuario pregunta sobre métricas de mantenimiento, la IA recurre a este archivo para llamar a una herramienta que extrae datos actualizados directamente desde el backend de GIMA.

🧠 **Concepto**: Las **tool calls** son funciones que la IA decide invocar basándose en la conversación. Tú defines la función y la IA decide cuándo usarla.

---

## 📄 `lib/services/backend-api-service.ts` — Cliente del Backend

Actúa como un cliente HTTP dedicado y especializado en entablar comunicación de bajo nivel con el backend tradicional de GIMA (desarrollado previsiblemente en Laravel). Sirve para centralizar la complejidad inherente a cualquier comunicación con servidores externos, manejando transparentemente la inyección de comprobantes de autenticación, la engorrosa lógica de paginación de datos masivos, el atrapado seguro de errores de red y el acople de respuesta.

---

## 📄 `lib/services/work-order-service.ts` — Servicio de Órdenes

Representa la capa de servicio focalizada única y exclusivamente en el ciclo de vida (CRUD) de las órdenes de trabajo técnicas. Sirve de interfaz de alto nivel para abstraer la complejidad hacia otras partes del sistema, permitiendo crear ágilmente nuevas incidencias, listar inventarios pendientes, actualizar estados de progreso o cerrar oficialmente órdenes de trabajo interaccionando íntimamente con el `BackendApiService` detallado anteriormente.

---

## 📄 `lib/services/voice-command-parser.ts` — Parser de Comandos

Es un decodificador avanzado que interpreta audazmente comandos de voz emitidos en lenguaje natural para transformarlos en cargas de acción puramente estructuradas. Sirve como el puente idiomático perfecto que toma frases desordenadas e instintivas del técnico, como por ejemplo "Crear una orden bien urgente para la manejadora de aire allá en el sector 3", y devuelve un JSON estricto listo para enrutarse:

```json
{
  "action": "create_work_order",
  "equipment": "UMA",
  "priority": "urgente",
  "location": "sector 3"
}
```

---

## 📄 `lib/services/checklist-ai-service.ts` — Servicio de Checklists

Es una especialización que hereda íntegramente de la superclase `BaseAIService`, configurada taxativamente para la generación de secuencias de control o listas de chequeo (checklists). Funciona estructuradamente tomando como input base una descripción escueta del equipo junto al nombre de la labor requerida, para luego despachar ambos hacia Gemini blindados con un prompt paramétrico enclaustrado; el retorno inevitablemente es un checklist exhaustivo y listo para consumo humano.

---

## 📄 `lib/services/activity-summary-ai-service.ts` — Resúmenes

Es un módulo derivado estricto de la base `BaseAIService`, dedicado a sintetizar la labor técnica bajo la premisa de generar reportes gerenciales. Su utilidad recae en su asombrosa capacidad de tomar registros esparcidos de intervenciones, fallas o actividades empíricas del técnico, logrando redactar con formato inmaculado y ortografía cuidada sendos resúmenes profesionales aptos para auditoría o evaluación corporativa.

---

## 📄 `lib/services/work-order-closeout-ai-service.ts` — Cierre de OTs

Consiste en la última faceta de automatización operativa, heredando de `BaseAIService` las cualidades para clausurar adecuadamente los procedimientos técnicos y documentales en los expedientes inactivos. Genera sin dilación detalladas notas formales de cierre o finiquito (closeout) que se adjuntarán a las órdenes de trabajo una vez el técnico o ingeniero da por completada cabalmente la avería reportada en la Universidad.

---

## 📄 `lib/services/contracts/work-order-service.contracts.ts`

Alberga las interfaces abstractas de TypeScript que dictan y definen los contratos formales inmutables por los que se rige imperiosamente el servicio de órdenes de trabajo. Sirve para ejercer un diseño técnico de altísimo estándar al apartar rigurosamente la definición de firmas (la interfaz pura) de la implementación interna (la lógica sucia), permitiendo así que distintos servicios del chatbot pasen a depender únicamente del contrato dictado en lugar del archivo local, fortaleciendo el encapsulamiento.

---

## 🔗 Flujo Completo — De Mensaje a Respuesta

```
Usuario escribe "¿Cuántas OTs hay pendientes?"
        │
        ▼
  ChatService.processMessage()
        │
        ├── Rate Limiter ✓
        ├── Zod Validation ✓
        ├── Sanitización ✓
        │
        ▼
  streamText() → GROQ (Llama 3.3)
        │
        │ La IA decide usar una herramienta:
        ├── Tool Call: listWorkOrders({ status: "pending" })
        │       │
        │       ▼
        │   BackendApiService → GET /api/work-orders?status=pending
        │       │
        │       └── { data: [...5 órdenes...] }
        │
        ▼
  La IA genera respuesta con los datos:
  "Hay 5 órdenes pendientes: OT-001, OT-002..."
```

---

**← Anterior**: [07 — Utilidades Core](./07-lib-utilidades.md) | **Siguiente**: [09 — Schemas de Validación](./09-lib-schemas.md) →
