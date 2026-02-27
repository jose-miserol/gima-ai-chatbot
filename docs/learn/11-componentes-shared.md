# 11 — Componentes Shared (`components/shared/`)

> Los componentes shared son componentes de alto nivel reutilizados en múltiples features. A diferencia de los UI (primitivos puros), estos tienen algo de lógica de negocio.

---

## 📄 `shared/error-boundary.tsx` — Capturador de Errores Global

Es una barrera arquitectónica (Error Boundary) diseñada para rodear y blindar la aplicación, encargándose de interceptar y capturar cualquier error imprevisible de JavaScript que germine en la jerarquía de componentes hijos durante el renderizado. Sirve para sustituir el colapso destructivo del árbol de React por una interfaz de usuario alternativa (UI de fallback) elegante, amigable y que ofrece típicamente un botón de reintento para que el usuario pueda recuperarse del fallo localmente. Existe como un salvavidas obligatorio porque la ausencia de este límite de contención provocaría que cualquier error no controlado (por ejemplo, inadvertidamente en el componente del Chat) desencadene un fallo en cascada desdibujando por completo la pantalla y dejando al operador frente a un fondo blanco inutilizable.

### ¿Cómo Funciona?

```
     Sin ErrorBoundary             Con ErrorBoundary
     ┌──────────────┐              ┌──────────────┐
     │    App       │              │    App       │
     │  ┌────────┐  │              │  ┌────────┐  │
     │  │ Chat   │  │              │  │ErrorB. │  │
     │  │  💥    │  │              │  │┌──────┐│  │
     │  │ ERROR  │  │              │  ││ Chat ││  │
     │  └────────┘  │              │  ││  💥  ││  │
     │              │              │  │└──────┘│  │
     │  PANTALLA    │              │  │"Algo   │  │
     │  BLANCA      │              │  │salió   │  │
     │              │              │  │mal"    │  │
     └──────────────┘              │  │[Reinten│  │
                                   │  │tar]    │  │
                                   │  └────────┘  │
                                   └──────────────┘
```

🧠 **Concepto**: React solo captura errores con class components. `ErrorBoundary` es un class component que envuelve la app entera en `layout.tsx`.

---

## 📄 `shared/confirm-dialog.tsx` — Diálogo de Confirmación

Es un componente modal multipropósito y personalizable formulado específicamente para centralizar la clásica pregunta de "¿Estás seguro?". Sirve fundamentalmente como un paso de fricción positiva e intencional que protege al usuario de invocar acciones potencialmente destructivas, irreversibles o sensibles del sistema (como purgar de golpe el historial de chat o truncar la subida de un archivo importante).

### Ejemplo de Uso

```tsx
<ConfirmDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  title="Borrar historial"
  description="¿Estás seguro? Esta acción no se puede deshacer."
  confirmLabel="Borrar"
  cancelLabel="Cancelar"
  variant="destructive" // ← Botón rojo de confirmar
  onConfirm={() => clearHistory()}
/>
```

💡 **¿Por qué un componente genérico?** En vez de crear un diálogo diferente para cada acción destructiva, tenemos uno configurable con props.

---

## 📄 `shared/feature-guard.tsx` — Guard de Feature Flags

Constituye el guardián declarativo a nivel de interfaz gráfica que condicionalmente invoca (o suprime) la pintura en pantalla de bloques enteros de contenido con base en el sistema de Feature Flags de la aplicación. Su utilidad es inmensa durante ciclos de integración continua, ya que permite fusionar código en producción con características aún experimentales o en desarrollo; si la bandera ("flag") dictamina que dicha funcionalidad está inactiva para el usuario en cuestión, el componente hijo jamás se renderizará ante sus ojos, resguardando la estabilidad pública del proyecto.

### Ejemplo de Uso

```tsx
<FeatureGuard feature="voiceCommands">
  <VoiceButton /> {/* Solo se muestra si voiceCommands está habilitado */}
</FeatureGuard>
```

🔗 **Relación**: Lee la configuración de `config/features.ts` (ver doc 05).

---

**← Anterior**: [10 — Componentes UI](./10-componentes-ui.md) | **Siguiente**: [12 — AI Elements](./12-componentes-ai-elements.md) →
