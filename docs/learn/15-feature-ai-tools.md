# 15 — Feature: AI Tools Dashboard (`features/ai-tools/`)

> Este módulo contiene el dashboard de herramientas de IA y los componentes compartidos que usan las 4 herramientas (Activity Summary, Checklist, Data Transform, Work Order Closeout).

---

## 📄 Archivos del Dashboard

| Archivo                 | ¿Para qué?                                                |
| ----------------------- | --------------------------------------------------------- |
| `dashboard.tsx`         | Página principal con tarjetas para cada herramienta de IA |
| `image-upload-test.tsx` | Componente de prueba para subida y análisis de imágenes   |
| `pdf-upload-test.tsx`   | Componente de prueba para subida y análisis de PDFs       |

---

## 📁 `shared/` — Componentes Compartidos entre Herramientas

Todas las herramientas de IA (Checklist, Activity Summary, etc.) comparten la misma estructura visual. Los componentes `shared` son los bloques reutilizables:

| Componente               | ¿Para qué?                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `ai-tool-layout.tsx`     | Layout estándar para todas las herramientas: título, breadcrumbs, sidebar, contenido principal |
| `ai-generation-form.tsx` | Formulario genérico de generación con IA: inputs, botón generar, estado de loading             |
| `ai-history-list.tsx`    | Lista de generaciones previas con timestamps y acciones (ver, eliminar, regenerar)             |
| `ai-preview-card.tsx`    | Tarjeta de preview del contenido generado con acciones (copiar, descargar, editar)             |
| `ai-status-badge.tsx`    | Badge de estado visual: "Generando..." (amarillo), "Completado" (verde), "Error" (rojo)        |
| `ai-usage-stats.tsx`     | Estadísticas de uso: generaciones totales, tokens usados, tiempo promedio                      |
| `types.ts`               | Tipos TypeScript compartidos entre herramientas                                                |
| `hooks/`                 | 1 hook compartido                                                                              |

### Patrón de Composición

Cada herramienta usa estos componentes shared así:

```tsx
// Ejemplo: Checklist Builder
<AIToolLayout title="Checklist Builder">
  <AIGenerationForm onGenerate={handleGenerate}>
    {/* Campos específicos del checklist */}
    <input name="equipment" />
    <select name="maintenanceType" />
  </AIGenerationForm>

  <AIPreviewCard data={generatedChecklist}>{/* Preview específico del checklist */}</AIPreviewCard>

  <AIHistoryList items={previousChecklists} />
  <AIUsageStats stats={checklistStats} />
</AIToolLayout>
```

💡 **¿Por qué componentes shared?** Las 4 herramientas tienen el mismo flujo (formulario → generar → preview → historial). En vez de duplicar código 4 veces, comparten estos componentes.

---

**← Anterior**: [14 — Feature: Voz](./14-feature-voice.md) | **Siguiente**: [16 — Herramientas IA](./16-feature-herramientas-ia.md) →
