# 16 — Las 4 Herramientas de IA

> Cada herramienta sigue el mismo patrón: un formulario recoge datos, una Server Action llama a la IA, y un preview muestra el resultado.

---

## Patrón Común (Las 4 herramientas lo siguen)

```
┌────────────────────────────────────────────┐
│                HERRAMIENTA                 │
│                                            │
│  ┌─── Formulario ───┐  ┌─── Preview ────┐  │
│  │ Input 1          │  │  Resultado     │  │
│  │ Input 2          │  │  generado      │  │
│  │ Input 3          │  │  por IA        │  │
│  │                  │  │                │  │
│  │ [Generar]        │  │  [Copiar]      │  │
│  └──────────────────┘  └────────────────┘  │
│                                            │
│  ┌─── Historial ───────────────────────┐   │
│  │ Generación 1 — hace 5 minutos       │   │
│  │ Generación 2 — hace 1 hora          │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

### Flujo de Datos Interno

```
Formulario → hooks/use-[tool]-generation.ts → Server Action → AI Service → Gemini
                                                                    ↓
Preview  ←  hooks/use-[tool]-state.ts  ←──── Resultado validado con Zod
```

---

## 🔧 1. Activity Summary (`features/activity-summary/`)

Funciona como un generador especializado en la redacción de resúmenes profesionales para asentar en bitácora las actividades de mantenimiento culminadas. Por ejemplo, al suministrarle datos crudos como "Cambié el filtro de la UMA-3, tardé 2 horas, usé filtro HEPA", la herramienta se encarga de pulir la narración y devolver un reporte técnico impecable:

> **Resumen de Actividad — 26/02/2026**
> Se realizó mantenimiento preventivo en la Unidad Manejadora de Aire (UMA-3). Se procedió con el reemplazo del filtro HEPA. Duración: 2 horas. Material utilizado: Filtro HEPA estándar. Estado resultante: operativo.

### Archivos

| Archivo                        | ¿Para qué?                                                          |
| ------------------------------ | ------------------------------------------------------------------- |
| `activity-summary.tsx`         | Componente principal orquestador                                    |
| `activity-summary-form.tsx`    | Formulario: tipo actividad, equipo, descripción, duración, personal |
| `activity-summary-preview.tsx` | Preview del resumen generado con formato profesional                |
| `activity-summary-list.tsx`    | Historial de resúmenes previos                                      |
| `constants.ts`                 | Tipos de actividad, equipos comunes                                 |
| `types.ts`                     | Tipos del módulo                                                    |
| `hooks/`                       | 5 hooks: estado, generación, historial, validación, exportación     |

### Cadena de Archivos

```
activity-summary-form.tsx
  → hooks/use-activity-generation.ts
    → actions/activity-summary.ts (Server Action)
      → services/activity-summary-ai-service.ts (BaseAIService)
        → Gemini API (con prompt de config/prompts/activity-summary-generation.ts)
          → schemas/activity-summary.schema.ts (validación de respuesta)
            → activity-summary-preview.tsx (mostrar resultado)
```

---

## 🔧 2. Checklist Builder (`features/checklist-builder/`)

Opera como un creador paramétrico de listas de chequeo ("checklists") de mantenimiento, moldeándolas de forma personalizada para tipologías de equipos específicos en la UNEG. A modo de ejemplo, si el técnico le instruye "Checklist preventivo mensual para la BCA del edificio 5", el sistema elabora y le devuelve una guía puntual con casillas de verificación paso a paso:

> **Checklist de Mantenimiento — BCA (Bomba Centrífuga de Agua)**
>
> - [ ] Inspeccionar sello mecánico
> - [ ] Verificar presión de operación
> - [ ] Revisar nivel de aceite del cojinete
> - [ ] Comprobar alineación del acople
> - [ ] Medir temperatura de rodamientos
> - [ ] Inspeccionar empaquetaduras

### Archivos

| Archivo                         | ¿Para qué?                                         |
| ------------------------------- | -------------------------------------------------- |
| `checklist-builder.tsx`         | Componente principal                               |
| `checklist-builder-form.tsx`    | Formulario: equipo, tipo mantenimiento, frecuencia |
| `checklist-builder-preview.tsx` | Preview del checklist con checkboxes interactivos  |
| `checklist-builder-list.tsx`    | Historial de checklists generados                  |
| `constants.ts`                  | Tipos de mantenimiento, frecuencias                |
| `types.ts`                      | Tipos del módulo                                   |
| `hooks/`                        | 5 hooks especializados                             |

---

## 🔧 3. Data Transformation (`features/data-transformation/`)

Desempeña el rol crucial de puente transformador, logrando convertir bloques de datos no estructurados en formatos rigurosos y útiles apalancándose en la flexibilidad cognitiva de la IA. Como ejemplo táctico, el operario puede pegar directamente una tabla sucia copiada de Excel junto con la instrucción "Normalizar nombres de equipos y agregar categoría", y la IA devolverá inmediatamente un objeto JSON limpio y validado.

### Archivos

| Archivo                           | ¿Para qué?                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| `data-transformation.tsx`         | Componente principal                                        |
| `data-transformation-form.tsx`    | Textarea para datos + campo de instrucciones                |
| `data-transformation-preview.tsx` | Preview con diff visual (antes/después)                     |
| `data-history-view.tsx`           | Historial de transformaciones con estadísticas              |
| `constants.ts`                    | Operaciones permitidas (filtrar, ordenar, normalizar, etc.) |
| `types.ts`                        | Tipos del módulo                                            |
| `hooks/`                          | 3 hooks especializados                                      |

---

## 🔧 4. Work Order Closeout (`features/work-order-closeout/`)

Se especializa expresamente en la clausura documental formal, generando notas de cierre redactadas en tono profesional absoluto para acompañar a las órdenes de trabajo recién completadas. A la práctica, el ingeniero le transfiere los datos sintéticos de la OT (tales como fallas halladas, materiales descontados del inventario y el tiempo incurrido), y la IA los sintetiza en una nota de finiquito integral y coherente para el archivo digital:

> **Nota de Cierre — OT-2024-0847**
> Se completó el mantenimiento correctivo del sistema de aire acondicionado (UMA-3, Sector B). Se reemplazó el compresor dañado y se recargó refrigerante R-410A. Tiempo total: 4 horas. Se recomienda programar inspección de seguimiento en 30 días.

### Archivos

| Archivo                     | ¿Para qué?                                          |
| --------------------------- | --------------------------------------------------- |
| `closeout-notes-modal.tsx`  | Modal completo: formulario + preview en una ventana |
| `closeout-notes-button.tsx` | Botón que abre el modal desde otras listas de OTs   |
| `constants.ts`              | Plantillas de notas, campos predefinidos            |
| `types.ts`                  | Tipos del módulo                                    |
| `hooks/`                    | 5 hooks especializados                              |

💡 **¿Por qué es un modal y no una página?** Porque el cierre de OT se hace desde una lista de órdenes existentes. El usuario no quiere navegar a otra página — quiere cerrar rápido y seguir.

---

## 🔗 ¿Cómo se Accede a Cada Herramienta?

Cada herramienta tiene su propia ruta en `app/tools/`:

| Ruta                         | Herramienta                       |
| ---------------------------- | --------------------------------- |
| `/tools`                     | Dashboard con tarjetas de todas   |
| `/tools/activity-summaries`  | → `features/activity-summary/`    |
| `/tools/checklist-builder`   | → `features/checklist-builder/`   |
| `/tools/data-transformation` | → `features/data-transformation/` |

El Work Order Closeout no tiene ruta propia — se accede como modal desde el chat.

---

**← Anterior**: [15 — AI Tools](./15-feature-ai-tools.md) | **Siguiente**: [17 — Types, Utils y Constants](./17-types-utils-constants.md) →
