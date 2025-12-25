# AI Tools - User Guide

> **Herramientas de inteligencia artificial** para optimizar la gestión de mantenimiento

## 🚀 Acceso Rápido

### Dashboard Principal

**Ruta:** `/tools`

Landing page central con acceso a todas las herramientas disponibles.

### Herramientas Disponibles

#### 1. Checklist Builder

**Ruta:** `/tools/checklist-builder`

Genera checklists de mantenimiento personalizados con IA.

**Características:**

- ✅ 10 tipos de activos (HVAC, caldera, bomba, compresor, generador, etc.)
- ✅ 4 tipos de mantenimiento (preventivo, correctivo, predictivo, inspección)
- ✅ Instrucciones personalizadas (hasta 500 caracteres)
- ✅ Contexto adicional (ubicación, modelo específico)
- ✅ Generación en segundos con llama-3.3-70b
- ✅ Historial de últimos 10 checklists en localStorage

**Flujo de uso:**

1. Selecciona tipo de activo
2. Selecciona tipo de mantenimiento
3. (Opcional) Agrega instrucciones personalizadas
4. Click "Generar Checklist"
5. Preview del checklist con items numerados
6. **Aceptar** para guardar o **Rechazar** para descartar
7. **Regenerar** para crear una nueva versión

**Output:**

- Checklist con items categorizados
- Cada item incluye descripción y notas
- Campo `required` indica criticidad

---

#### 2. Activity Summaries

**Ruta:** `/tools/activity-summaries`

Genera resúmenes profesionales de actividades de mantenimiento.

**Características:**

- ✅ 3 estilos: Ejecutivo, Técnico, Narrativo
- ✅ 3 niveles de detalle: Bajo, Medio, Alto
- ✅ Resumen ejecutivo automático
- ✅ Secciones estructuradas con contenido y bullet points
- ✅ Métricas: word count, reading time
- ✅ Historial con preview de 120 caracteres

**Flujo de uso:**

1. Selecciona tipo de activo y tarea
2. Describe actividades realizadas (hasta 2000 caracteres)
3. Selecciona estilo (para qué audiencia)
4. Selecciona nivel de detalle
5. Click "Generar Resumen"
6. Preview multi-sección:
   - Executive summary
   - Secciones detalladas con títulos
   - Items bullet por sección (opcional)
7. **Aceptar** para guardar

**Output:**

- Título profesional
- Resumen ejecutivo (1-2 párrafos)
- Secciones ordenadas con contenido detallado
- Metadata: wordCount, readingTime, style, detailLevel

---

#### 3. Work Order Closeout

**Tipo:** Modal (integrado en WO detail pages)

Genera notas de cierre profesionales para órdenes de trabajo.

**Características:**

- ✅ Pre-populated con datos del Work Order
- ✅ 3 estilos: Formal, Technical, Brief
- ✅ Opción de incluir recomendaciones
- ✅ 7 secciones estructuradas
- ✅ Callback para guardar en DB

**Integración en código:**

```tsx
import { CloseoutNotesButton } from '@/app/components/features/work-order-closeout';

// En tu Work Order detail page:
<CloseoutNotesButton
  workOrderData={{
    id: workOrder.id,
    title: workOrder.title,
    description: workOrder.description,
    assetType: workOrder.assetType,
    taskType: workOrder.taskType,
    priority: workOrder.priority,
    activities: workOrder.activities, // string[]
    materialsUsed: workOrder.materialsUsed, // string[] opcional
    timeSpent: workOrder.timeSpent, // number (horas)
    issues: workOrder.issues, // string[] opcional
  }}
  onNotesAccepted={(notes) => {
    // Guardar notes en tu DB
    saveCloseoutNotes(workOrder.id, notes);
  }}
  variant="default"
/>;
```

**Flujo de uso:**

1. Click "Generar Notas de Cierre" en WO detail
2. Modal abre mostrando info del WO
3. Selecciona estilo (formal/technical/brief)
4. Toggle "Incluir recomendaciones"
5. Click "Generar Notas"
6. Preview con 7 secciones:
   - Summary
   - Work Performed
   - Findings
   - Recommendations (si está habilitado)
   - Materials Used
   - Time Breakdown
   - Next Actions (opcional)
7. **Aceptar** → Callback ejecutado con notas

**Output:**

```typescript
{
  id: string;
  workOrderId: string;
  summary: string;
  workPerformed: string;
  findings: string;
  recommendations?: string;
  materialsUsed: string;
  timeBreakdown: string;
  nextActions?: string;
  style: 'formal' | 'technical' | 'brief';
  createdAt: Date;
  metadata: { wordCount, generatedBy, version };
}
```

---

## 🏗️ Arquitectura

### Shared Components

Todos los AI tools usan componentes compartidos de `app/components/features/ai-tools/shared/`:

- **AIToolLayout** - Layout consistente con header y grid 2 columnas
- **AIGenerationForm** - Form genérico con validación multi-campo
- **AIPreviewCard** - Preview estándar con metadata y actions
- **AIHistoryList** - Lista de generaciones con empty state
- **AIStatusBadge** - Estados visuales (idle/generating/success/error/cached)
- **AIUsageStats** - Métricas de uso desde localStorage

### AI Services

Cada herramienta integra su service correspondiente:

- `ChecklistAIService` - Checklist generation
- `ActivitySummaryAIService` - Activity summaries
- `WorkOrderCloseoutAIService` - Closeout notes

Todos heredan de `BaseAIService` con:

- ✅ Retry logic (3 intentos)
- ✅ Caching inteligente
- ✅ Structured logging
- ✅ Zod validation (input + output)
- ✅ Error handling

### Modelo de IA

**Provider:** GROQ  
**Modelo:** llama-3.3-70b-versatile  
**Features:**

- Generación rápida (< 5 segundos típico)
- Resultados consistentes y profesionales
- JSON structured output
- Context window: 128k tokens

---

## 💾 Almacenamiento

### localStorage Keys

- `ai-usage-checklist-builder` - Usage stats
- `ai-usage-activity-summaries` - Usage stats
- `checklist-history-*` - Historial de checklists
- `summary-history-*` - Historial de resúmenes
- `closeout-history-*` - Historial de notas

**Estructura:**

```typescript
{
  used: number;
  quota: number;
  trend: string; // ej: "+15%"
}
```

### Caché de AI Responses

Manejado por `BaseAIService` con TTL configurables:

- Checklists: 1 hora
- Summaries: 1 hora
- Closeouts: 30 minutos

---

## 🎨 UX Patterns

### Estados de Generación

1. **Idle** - Form visible, historial en preview column
2. **Generating** - Loading state, form disabled, spinner
3. **Success** - Preview card con contenido generado
4. **Cached** - Badge "Cached" en metadata
5. **Error** - Toast notification con mensaje de error

### Actions Disponibles

- **Accept** - Guarda la generación (callback/localStorage)
- **Reject** - Descarta y vuelve al form
- **Regenerate** - Nueva generación con mismos parámetros
- **Edit** - (Futuro) Editar contenido generado

### Toast Notifications

Feedback visual para todas las acciones:

- ✅ Generación exitosa
- ✨ Cargado desde caché
- ❌ Error al generar
- 🗑️ Item eliminado del historial

---

## 🚧 Próximas Mejoras

### Features Planeadas

- [ ] Copy to clipboard functionality
- [ ] Export como PDF
- [ ] Template saving y reutilización
- [ ] Edición inline de contenido generado
- [ ] Comparar múltiples generaciones
- [ ] Bulk operations
- [ ] Keyboard shortcuts

### Database Integration

Actualmente usa `localStorage`. Migración planeada a DB:

- Persist generaciones long-term
- User quotas y tracking
- Analytics de uso
- Team templates compartidos

### Advanced Features

- Custom AI parameters (temperature, max tokens)
- Fine-tuning con feedback
- Multi-language support
- Voice input integration

---

## 📊 Métricas de Uso

### Analytics Recomendadas

Track en tu sistema de analytics:

- Herramienta más usada
- Tiempo promedio de generación
- Tasa de aceptación vs rechazo
- Regeneraciones por sesión
- Features más populares

### Performance

- **Target:** < 5s generación
- **Typical:** 2-4s con caché warm
- **Max:** 10s (retry included)

---

## 🐛 Troubleshooting

### Error: "Error al generar"

**Causa:** API key inválida o rate limit
**Solución:** Verificar `GROQ_API_KEY` en env variables

### Error: "Respuesta de IA inválida"

**Causa:** Output parsing falló
**Solución:** Retry automático activo (3 intentos)

### Historial vacío

**Causa:** localStorage cleared
**Solución:** Normal behavior, se reconstruye con uso

### Modal no abre

**Causa:** Missing Dialog dependencies
**Solución:** Verificar shadcn/ui Dialog component instalado

---

## 📝 Change Log

### v1.0.0 (Sprint C.0 - C.4)

- ✅ Shared AI components (6 componentes)
- ✅ Checklist Builder page
- ✅ Activity Summaries page
- ✅ WO Closeout modal integration
- ✅ AI Tools Dashboard
- ✅ Complete UI consolidation

---

**Powered by llama-3.3-70b-versatile via GROQ** 🚀
