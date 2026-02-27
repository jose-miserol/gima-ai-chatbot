# 09 — Schemas de Validación (`lib/schemas/`)

> Los schemas definen la "forma" exacta de los datos. Si un dato no coincide con su schema, es rechazado antes de que cause problemas.

---

## 🧠 ¿Qué es un Schema Zod?

Imagina un formulario de papel con campos obligatorios. Un schema Zod es lo mismo pero para datos en código:

```typescript
// Sin Zod — cualquier cosa puede pasar
function processData(data: any) {
  // ¿data.name existe? ¿Es string? ¿Está vacío? No sabemos...
}

// Con Zod — garantías absolutas
const schema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
});

function processData(data: unknown) {
  const validated = schema.parse(data); // ← Falla si es inválido
  // validated.name SIEMPRE es string no vacío ✓
  // validated.age SIEMPRE es número positivo ✓
}
```

---

## 📄 `schemas/chat.ts` — Mensajes del Chat

Ejerce la validación estricta sobre la estructura íntegra de cada solicitud (request) que ingresa al endpoint `POST /api/chat`. Su propósito es certificar que los datos posean obligatoriamente el formato conversacional previsto (incluyendo array de mensajes, roles correctos y un identificador de modelo válido). Existe como una medida de seguridad activa porque un usuario malintencionado podría inyectar datos malformados en la red; este esquema los repudia de entrada antes de que escalen hacia la IA o generen costosas fallas de procesamiento.

Valida que:

- `messages` sea un array de objetos con `role` y `content`
- `role` sea solo `user`, `assistant`, o `system`
- `model` sea uno de los modelos permitidos

---

## 📄 `schemas/backend-response.schema.ts` — Respuestas del Backend

Se encarga de validar la morfología de las respuestas de red emuladas o reales provenientes del backend tradicional de GIMA (Laravel), particularmente aquellas paginadas. Está diseñado con la premisa de vigilar el flujo de datos entrante asimilado por el frontend. Existe por seguridad de integración: si alguna actualización en el backend altera inopinadamente las llaves del JSON, este esquema arroja un aviso evidente de inmediato en lugar de causar errores silenciosos e imposibles de rastrear durante el renderizado.

---

## 📄 `schemas/activity-summary.schema.ts`

Es el molde validador enfocado en certificar los datos de entrada y el resultado final que transita por el generador de resúmenes de actividades. Funciona certificando que existan y posean el tipo correcto propiedades imperativas tales como: el tipo de actividad reportada, la identificación del equipo afectado, una descripción mínima, la duración temporal y el personal involucrado, robusteciendo así la consistencia semántica del reporte final.

---

## 📄 `schemas/checklist.schema.ts`

Corresponde al esquema que certifica los cimientos estructurales de los datos empleados para generar y representar gráficamente listas de chequeo de mantenimiento. Actúa exigiendo atributos precisos para el cruce de datos con la IA, asegurándose de validar la presencia del nombre del equipo estudiado, la clase de mantenimiento previsto, un arreglo válido con los ítems individuales de revisión y sus respectivas prioridades lógicas preestablecidas.

---

## 📄 `schemas/data-transformation.schema.ts`

Valida matemáticamente la indemnidad de los datos tanto en la etapa de entrada como en la respuesta procesada producida por la herramienta de transformación inteligente. Impone la obligación de recibir un paquete que contenga fielmente los datos crudos fuente junto con la directriz textual de transformación, asegurando al final del ciclo completo que la salida devuelta al técnico ostente un JSON unificado y rigurosamente estructurado, con estadísticas genuinas de procesamiento adjuntas.

---

## 📄 `schemas/work-order-closeout.schema.ts`

Garantiza el formato veraz e inquebrantable que deben seguir las notas de dictamen para el cierre formal de órdenes de servicio una vez completadas. Su misión pericial radica en comprobar que el sistema consigne sistemáticamente campos fundamentales, asegurando no omitir en el JSON final la descripción integral del trabajo ejecutado, el desglose verificado de consumibles o repuestos, la cuenta del tiempo total invertido por el operario y las salvedades o recomendaciones adjuntas para el futuro.

---

## 📄 `schemas/index.ts` — Re-exportación

```typescript
export { chatRequestSchema } from './chat';
export { checklistSchema } from './checklist.schema';
// ... etc
```

💡 **Patrón**: Igual que en otros módulos, un `index.ts` centraliza las exportaciones para imports más limpios.

---

## 💡 ¿Por Qué Schemas en Todas Partes?

```
Sin validación:
  Usuario ──→ Datos ──→ Servidor ──→ IA ──→ Respuesta
                    ↑                    ↑
               ¿Válidos?             ¿Formato correcto?
               No sabemos            No sabemos

Con Zod:
  Usuario ──→ Schema ✓──→ Servidor ──→ IA ──→ Schema ✓──→ Respuesta
                 │                              │
            Rechaza datos                 Garantiza formato
             inválidos                      de salida
```

---

**← Anterior**: [08 — Servicios de IA](./08-lib-servicios-ia.md) | **Siguiente**: [10 — Componentes UI](./10-componentes-ui.md) →
