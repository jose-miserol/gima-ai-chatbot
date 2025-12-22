# Reglas de Desarrollo - Proyecto GIMA

> **📌 Documento normativo:** Estándares obligatorios para el desarrollo de componentes en el proyecto GIMA AI Chatbot. Todas las contribuciones deben cumplir con estas reglas.

**Última actualización:** 2025-12-21  
**Versión:** 1.0

---

## 📐 Principios Fundamentales

### 1. **Componentes Pequeños y Enfocados**

- ✅ **Máximo 200 líneas** por archivo de componente
- ✅ **Complejidad ciclomática < 10** (McCabe)
- ✅ **Una responsabilidad por componente** (Single Responsibility Principle)
- ❌ **Prohibido:** Componentes monolíticos con múltiples responsabilidades

**Ejemplo:**

```tsx
// ❌ MAL: 462 líneas, múltiples responsabilidades
export function ChatInterface() {
  // Chat management
  // Voice input
  // Image analysis
  // UI rendering
  // Keyboard shortcuts
}

// ✅ BIEN: Dividir en componentes especializados
export function ChatInterface() {
  return (
    <>
      <ChatHeader />
      <ChatConversation />
      <ChatInputArea />
    </>
  );
}
```

---

## 🚫 Anti-Patrones Prohibidos

### 1. **NUNCA Modificar Prototipos Nativos del DOM**

```tsx
// ❌ PROHIBIDO - RIESGO DE SEGURIDAD
HTMLTextAreaElement.prototype.updateValue = function (newValue: string) {
  this.value = newValue;
};

// ✅ OBLIGATORIO - Usar refs de React
const textareaRef = useRef<HTMLTextAreaElement>(null);

const updateTextareaValue = useCallback((newValue: string) => {
  if (textareaRef.current) {
    textareaRef.current.value = newValue;
    textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
  }
}, []);
```

**Justificación:**

- Modifica objetos nativos del navegador (riesgo de seguridad)
- Rompe compatibilidad con React
- Causa conflictos con otras librerías
- Dificulta el debugging

---

### 2. **NUNCA setState Durante Render**

```tsx
// ❌ PROHIBIDO
function Component() {
  const [mounted, setMounted] = useState(false);

  if (typeof window !== 'undefined' && !mounted) {
    setMounted(true); // ❌ Setter en render phase
  }
}

// ✅ OBLIGATORIO - Usar useEffect
function Component() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
}
```

---

### 3. **NUNCA Usar `any` en TypeScript**

```tsx
// ❌ PROHIBIDO
function processData(data: any) {}

// ✅ OBLIGATORIO - Tipos específicos
interface UserData {
  id: string;
  name: string;
}

function processData(data: UserData) {}
```

---

## ✅ Patrones Obligatorios

### 1. **Gestión de Estado en SSR/Next.js**

Para cualquier estado que dependa de APIs del navegador (`localStorage`, `matchMedia`, etc.):

```tsx
// ✅ PATRÓN OBLIGATORIO: useSyncExternalStore
import { useSyncExternalStore } from 'react';

const themeStore = {
  getSnapshot(): Theme {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as Theme) || 'light';
  },

  getServerSnapshot(): Theme {
    return 'light'; // Valor por defecto servidor
  },

  subscribe(callback: () => void) {
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  },
};

function useTheme() {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  );

  return { theme };
}
```

**Beneficios:**

- Elimina hydration mismatches
- Compatible con React 18 Concurrent Rendering
- Previene "tearing" visual
- Estándar oficial de React

---

### 2. **Gestión de Variantes de Estilos: CVA**

Para componentes con múltiples estados visuales:

```tsx
// ✅ PATRÓN OBLIGATORIO: Class Variance Authority (CVA)
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base styles
  'rounded-full transition-all duration-300',
  {
    variants: {
      state: {
        idle: 'bg-white text-gray-900',
        active: 'bg-blue-600 text-white',
        disabled: 'opacity-50 cursor-not-allowed',
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    compoundVariants: [
      {
        state: 'active',
        size: 'lg',
        className: 'shadow-lg',
      },
    ],
    defaultVariants: {
      state: 'idle',
      size: 'md',
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onClick?: () => void;
}

export function Button({ state, size, onClick }: ButtonProps) {
  return (
    <button className={buttonVariants({ state, size })} onClick={onClick}>
      {/* ... */}
    </button>
  );
}
```

**Instalación requerida:**

```bash
npm install class-variance-authority
```

---

### 3. **Error Boundaries con Prevención de Bucles Infinitos**

```tsx
// ✅ PATRÓN OBLIGATORIO: ErrorBoundary con retryCount
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  maxRetries?: number; // Default: 3
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number; // OBLIGATORIO
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    // Incrementar contador
    this.setState((prev) => ({ retryCount: prev.retryCount + 1 }));

    // PREVENCIÓN DE BUCLE INFINITO
    if (retryCount >= maxRetries) {
      console.error('Límite de reintentos alcanzado');
      return; // No permitir más resets
    }

    // Error reporting en producción
    if (process.env.NODE_ENV === 'production') {
      reportErrorToService(error);
    }
  }
}
```

---

## 📁 Estructura de Archivos

### Organización de Componentes

```
components/
├── features/              # Componentes de negocio
│   ├── chat/
│   │   ├── ChatInterface.tsx      # Orquestador principal (<150 líneas)
│   │   ├── ChatHeader.tsx         # Subcomponente
│   │   ├── ChatConversation.tsx   # Subcomponente
│   │   ├── ChatInputArea.tsx      # Subcomponente
│   │   ├── hooks/
│   │   │   ├── useChatState.ts    # Lógica de estado
│   │   │   ├── useChatSubmit.ts   # Lógica de envío
│   │   │   └── useImageAnalysis.ts # Lógica de análisis
│   │   ├── constants.ts           # Configuración
│   │   ├── types.ts               # Tipos e interfaces
│   │   └── index.ts               # Barrel export
│   └── theme/
│       ├── ThemeToggle.tsx
│       └── index.ts
└── shared/                # Componentes reutilizables
    ├── ErrorBoundary.tsx
    ├── Button.tsx
    └── index.ts
```

---

## 🎨 Convenciones de Código

### Nomenclatura

```tsx
// ✅ Componentes: PascalCase
export function ChatInterface() {}
export const VoiceButton = forwardRef(() => {});

// ✅ Hooks personalizados: camelCase con prefijo "use"
function useChatState() {}
function useImageAnalysis() {}

// ✅ Event handlers: "handle" + acción
const handleClick = () => {};
const handleSubmit = () => {};

// ✅ Callbacks como props: "on" + evento
interface Props {
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// ✅ Boolean: prefijos is/has/can/should
const isLoading = false;
const hasError = false;
const canSubmit = true;
const shouldUpdate = false;

// ✅ Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// ✅ Archivos de configuración: camelCase o kebab-case
// constants.ts, chat-config.ts
```

---

### Orden de Elementos en Componentes

```tsx
'use client';

// 1. Imports externos
import { useState, useCallback } from 'react';
import { SomeIcon } from 'lucide-react';

// 2. Imports internos
import { cn } from '@/app/lib/utils';
import { useCustomHook } from '@/app/hooks';

// 3. Types/Interfaces
interface ComponentProps {
  title: string;
  onAction?: () => void;
}

// 4. Constants (módulo-level)
const CONSTANTS = {
  MAX_LENGTH: 100,
};

// 5. Helper functions
function helperFunction(value: string): string {
  return value.trim();
}

// 6. Component
export function Component({ title, onAction }: ComponentProps) {
  // 6.1. Hooks de estado
  const [state, setState] = useState();

  // 6.2. Hooks personalizados
  const customData = useCustomHook();

  // 6.3. Callbacks memoizados
  const handleAction = useCallback(() => {
    // ...
  }, []);

  // 6.4. Effects
  useEffect(() => {
    // ...
  }, []);

  // 6.5. Early returns (guards)
  if (!state) return <Skeleton />;

  // 6.6. Render
  return <div>{/* JSX */}</div>;
}

// 7. displayName (si usa memo/forwardRef)
Component.displayName = 'Component';
```

---

## ♿ Accesibilidad (A11y)

### Requisitos Obligatorios

```tsx
// ✅ 1. ARIA labels en todos los elementos interactivos
<button
  aria-label="Cerrar diálogo"
  aria-describedby="dialog-description"
>
  <X />
</button>

// ✅ 2. Roles semánticos
<div role="status" aria-live="polite">
  Cargando mensaje...
</div>

// ✅ 3. Screen reader only text
<button>
  <TrashIcon />
  <span className="sr-only">Eliminar mensaje</span>
</button>

// ✅ 4. Estados de carga accesibles
<div role="status" aria-busy="true" aria-label="Cargando">
  <Skeleton />
  <span className="sr-only">Cargando contenido...</span>
</div>

// ✅ 5. NO usar confirm() nativo
// ❌ PROHIBIDO
if (confirm('¿Eliminar?')) { }

// ✅ OBLIGATORIO - Diálogo accesible
<ConfirmDialog
  title="Eliminar historial"
  description="Esta acción no se puede deshacer"
  onConfirm={handleDelete}
/>
```

---

## 🎯 Performance

### Optimizaciones Obligatorias

```tsx
// ✅ 1. Memoizar componentes pesados
const ChatMessage = memo(({ message }) => {
  // Renderizado costoso
});

// ✅ 2. Callbacks memoizados
const handleSubmit = useCallback(
  async (data) => {
    await sendMessage(data);
  },
  [sendMessage]
);

// ✅ 3. useMemo para cálculos costosos
const sortedMessages = useMemo(() => {
  return messages.sort((a, b) => a.timestamp - b.timestamp);
}, [messages]);

// ✅ 4. Lazy loading de componentes pesados
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// ✅ 5. Usar displayName en componentes memoizados
ChatMessage.displayName = 'ChatMessage';
```

---

## 📦 Exports

### Barrel Exports (index.ts)

```tsx
// ✅ PATRÓN OBLIGATORIO en index.ts
export { ChatInterface } from './ChatInterface';
export { ChatHeader } from './ChatHeader';
export { ChatConversation } from './ChatConversation';

// Re-exportar tipos si son públicos
export type { ChatMessage, ChatConfig } from './types';

// ❌ NO hacer export * (dificulta tree-shaking)
export * from './ChatInterface'; // ❌ EVITAR
```

---

## 🧪 Testing

### Requisitos Mínimos

```tsx
// ✅ Todo componente debe tener tests básicos
describe('ChatInterface', () => {
  it('should render without crashing', () => {
    render(<ChatInterface />);
  });

  it('should handle user input', () => {
    const { getByRole } = render(<ChatInterface />);
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(input).toHaveValue('Hello');
  });

  it('should submit message on form submit', async () => {
    const onSubmit = jest.fn();
    const { getByRole } = render(<ChatInterface onSubmit={onSubmit} />);

    fireEvent.submit(getByRole('form'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});
```

---

## 📝 Documentación

### JSDoc Obligatorio

````tsx
/**
 * Hook personalizado para gestión del estado del chat
 *
 * @param storageKey - Clave para persistencia en localStorage
 * @returns Estado del chat y funciones de control
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, status } = useChatState({
 *   storageKey: 'my-chat-v1'
 * });
 * ```
 */
export function useChatState({ storageKey }: ChatStateOptions) {
  // ...
}
````

---

## 🔧 Herramientas Requeridas

### Configuración del Proyecto

```json
// package.json - Dependencias obligatorias
{
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-jsx-a11y": "^6.8.0"
  }
}
```

### ESLint Rules

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "jsx-a11y/alt-text": "error",
    "max-lines": ["warn", { "max": 200 }],
    "complexity": ["warn", 10]
  }
}
```

---

## ⚡ Checklist Pre-Commit

Antes de hacer commit, verifica:

- [ ] ✅ Componente < 200 líneas
- [ ] ✅ Complejidad < 10
- [ ] ✅ Sin `any` en TypeScript
- [ ] ✅ Sin modificación de prototipos nativos
- [ ] ✅ Props con tipos e interfaces
- [ ] ✅ ARIA labels en elementos interactivos
- [ ] ✅ Tests básicos escritos
- [ ] ✅ JSDoc en funciones públicas
- [ ] ✅ `displayName` en componentes memoizados
- [ ] ✅ Barrel exports en `index.ts`
- [ ] ✅ ESLint sin errores
- [ ] ✅ TypeScript sin errores

---

## 🚨 Revisión de Código

### Criterios de Rechazo Automático

Un PR será **rechazado automáticamente** si:

1. ❌ Modifica prototipos nativos del DOM
2. ❌ Usa `any` en TypeScript
3. ❌ Componente > 200 líneas sin justificación
4. ❌ Complejidad ciclomática > 10
5. ❌ Sin tests para nuevo componente
6. ❌ Errores de ESLint o TypeScript
7. ❌ Falta accesibilidad básica (ARIA labels)
8. ❌ Usa `confirm()` o `alert()` nativo

---

## 📚 Referencias

- [React Hooks Rules](https://react.dev/reference/rules)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Accessibility WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [CVA Documentation](https://cva.style/docs)
- [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)

---

## 📞 Contacto

Para dudas sobre estas reglas, consulta:

- **Documento de análisis:** `/docs/NOTES.md`
- **Evaluación técnica:** `/docs/EVAL.md`
- **Guía de contribución:** `/docs/CONTRIBUTING.md`

---

**Nota Final:** Estas reglas son **obligatorias** y están basadas en el análisis técnico exhaustivo del proyecto. No son sugerencias, son estándares que garantizan la calidad, mantenibilidad y escalabilidad del código.
