# 10 — Componentes UI (`components/ui/`)

> Los componentes UI son los **bloques de construcción más básicos** de la interfaz. Son como piezas de LEGO: genéricos, reutilizables, y sin lógica de negocio.

---

## 🧠 ¿De Dónde Vienen?

Están basados en **shadcn/ui** + **Radix UI**:

- **Radix UI**: Biblioteca de componentes accesibles, sin estilo visual. Provee la lógica (abrir/cerrar modal, manejar focus, teclado, etc.)
- **shadcn/ui**: Capa de estilo sobre Radix con Tailwind CSS. No es un paquete npm — es código que se copia al proyecto y se personaliza.

💡 **¿Por qué no usar una librería como Material UI?** Porque shadcn/ui te da el código fuente. Puedes modificar cualquier componente sin limitaciones. No dependes de actualizaciones de terceros.

---

## Lista Completa — 24 Componentes

### Componentes de Formulario

| Componente      | Archivo            | ¿Para qué?                                                                  |
| --------------- | ------------------ | --------------------------------------------------------------------------- |
| **Button**      | `button.tsx`       | Botones con variantes: `default`, `destructive`, `outline`, `ghost`, `link` |
| **ButtonGroup** | `button-group.tsx` | Agrupa botones relacionados visualmente                                     |
| **Input**       | `input.tsx`        | Campo de texto de una línea                                                 |
| **Textarea**    | `textarea.tsx`     | Campo de texto multilínea                                                   |
| **InputGroup**  | `input-group.tsx`  | Input con ícono a la izquierda y label integrado                            |
| **Label**       | `label.tsx`        | Etiqueta accesible para campos de formulario                                |
| **Checkbox**    | `checkbox.tsx`     | Casilla de verificación                                                     |
| **Select**      | `select.tsx`       | Menú desplegable de selección                                               |

### Componentes de Layout

| Componente      | Archivo           | ¿Para qué?                                               |
| --------------- | ----------------- | -------------------------------------------------------- |
| **Card**        | `card.tsx`        | Contenedor con header, body y footer                     |
| **Separator**   | `separator.tsx`   | Línea horizontal o vertical divisoria                    |
| **ScrollArea**  | `scroll-area.tsx` | Área con scroll personalizado (más bonito que el nativo) |
| **Collapsible** | `collapsible.tsx` | Sección que se expande/colapsa                           |
| **Carousel**    | `carousel.tsx`    | Carrusel de contenido deslizable (usa Embla)             |

### Componentes de Feedback

| Componente   | Archivo        | ¿Para qué?                                           |
| ------------ | -------------- | ---------------------------------------------------- |
| **Alert**    | `alert.tsx`    | Mensaje informativo con ícono y colores semánticos   |
| **Badge**    | `badge.tsx`    | Etiqueta pequeña de estado (ej: "Activo", "Urgente") |
| **Progress** | `progress.tsx` | Barra de progreso animada                            |
| **Skeleton** | `skeleton.tsx` | Placeholder animado de carga (efecto de "parpadeo")  |
| **Toast**    | `toast.tsx`    | Notificación temporal que aparece y desaparece       |
| **Sonner**   | `sonner.tsx`   | Sistema de toasts alternativo con más opciones       |

### Componentes de Overlay

| Componente       | Archivo             | ¿Para qué?                                                |
| ---------------- | ------------------- | --------------------------------------------------------- |
| **Dialog**       | `dialog.tsx`        | Ventana modal centrada (para confirmaciones, formularios) |
| **DropdownMenu** | `dropdown-menu.tsx` | Menú desplegable contextual (click derecho / botón)       |
| **Tooltip**      | `tooltip.tsx`       | Tooltip al hacer hover sobre un elemento                  |
| **HoverCard**    | `hover-card.tsx`    | Tarjeta rica que aparece al hover (como en GitHub)        |
| **Command**      | `command.tsx`       | Paleta de comandos tipo Spotlight / Cmd+K                 |

---

## 🧩 Anatomía de un Componente UI

Todos siguen el mismo patrón. Ejemplo con `button.tsx`:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';

// 1. Definir variantes con CVA
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium', // Base
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

// 2. Componente React con forwardRef
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
```

🧠 **Concepto**: **CVA (Class Variance Authority)** genera clases CSS dinámicamente según las props. `<Button variant="destructive" size="sm">` produce las clases exactas para un botón rojo y pequeño.

---

**← Anterior**: [09 — Schemas](./09-lib-schemas.md) | **Siguiente**: [11 — Componentes Shared](./11-componentes-shared.md) →
