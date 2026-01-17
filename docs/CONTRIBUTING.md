# Guía de Contribución - GIMA AI Chatbot

¡Gracias por tu interés en mejorar este proyecto! Esta guía establece los estándares para mantener la calidad y consistencia del código.

## 🛠️ Herramientas Requeridas

- **Node.js**: v20 o superior
- **Gestor de paquetes**: npm (usamos `package-lock.json`)
- **Editor**: VS Code con extensiones ESLint y Prettier

## 📋 Setup Inicial

```bash
npm install
cp .env.example .env.local
# Configura tus API Keys en .env.local
```

## 🔧 Comandos Disponibles

| Comando                 | Descripción                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                   |
| `npm run build`         | Build de producción                      |
| `npm run start`         | Servidor de producción                   |
| `npm run lint`          | Verificar estilo de código               |
| `npm run lint:fix`      | Corregir errores de lint automáticamente |
| `npm run format`        | Formatear código con Prettier            |
| `npm run type-check`    | Verificar tipos de TypeScript            |
| `npm test`              | Ejecutar tests con Vitest                |
| `npm run test:ui`       | Ejecutar tests con UI interactiva        |
| `npm run test:coverage` | Generar reporte de cobertura             |
| `npm run analyze`       | Analizar el bundle de producción         |

## 🪝 Git Hooks (Husky)

Este proyecto usa **Husky** para automatizar verificaciones de calidad:

| Hook         | Acción                                    | Cuándo                        |
| ------------ | ----------------------------------------- | ----------------------------- |
| `pre-commit` | Ejecuta `lint-staged` (ESLint + Prettier) | Antes de cada commit          |
| `commit-msg` | Valida formato con `commitlint`           | Al escribir mensaje de commit |
| `pre-push`   | Ejecuta `type-check`                      | Antes de push al remoto       |

## 📝 Conventional Commits

Los mensajes de commit **deben** seguir el formato:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Tipos Permitidos

| Tipo       | Descripción                             |
| ---------- | --------------------------------------- |
| `feat`     | ✨ Nueva funcionalidad                  |
| `fix`      | 🐛 Corrección de bugs                   |
| `docs`     | 📚 Documentación                        |
| `style`    | 💄 Formato (espacios, comas, etc.)      |
| `refactor` | ♻️ Refactorización sin cambio de lógica |
| `perf`     | ⚡ Mejoras de performance               |
| `test`     | 🧪 Tests                                |
| `build`    | 📦 Sistema de build o dependencias      |
| `ci`       | 🔧 CI/CD                                |
| `chore`    | 🔨 Tareas de mantenimiento              |
| `revert`   | ⏪ Revertir commits                     |

### Ejemplos

```bash
# ✅ Correcto
git commit -m "feat(chat): add voice input support"
git commit -m "fix(api): handle empty message error"
git commit -m "docs: update README with setup instructions"

# ❌ Incorrecto (serán rechazados)
git commit -m "Added new feature"      # Sin tipo
git commit -m "Feat: something"        # Mayúscula
git commit -m "fix: Something."        # Termina con punto
```

## 📐 Estándares de Código

### TypeScript

- **Strict Mode**: Activado. Evitar `any` cuando sea posible.
- **Interfaces**: Prefiere `interface` sobre `type` para objetos.
- **Imports**: Usar alias `@/` para rutas absolutas.

### React

- Componentes funcionales con Hooks.
- Server Components por defecto, usar `'use client'` solo cuando sea necesario.
- Componentes UI reutilizables en `app/components/ui`.

### Estructura de Archivos

```
app/
├── api/                 # API Routes
├── actions/             # Server Actions (voice, vision, files, etc.)
├── components/          # Componentes React
│   ├── ui/              # Componentes UI base (shadcn/ui)
│   ├── ai-elements/     # Componentes específicos de AI
│   └── features/        # Features (chat, voice, ai-tools, etc.)
├── config/              # Configuración (env, constants)
├── constants/           # Constantes del sistema (AI models, etc.)
├── hooks/               # Custom React Hooks
├── lib/                 # Librerías (AI services, schemas, utils)
│   ├── ai/              # AI Services
│   ├── schemas/         # Zod validation schemas
│   └── services/        # Business logic services
├── tools/               # AI Tools pages (dashboard, checklist, etc.)
├── types/               # TypeScript types/interfaces
└── utils/               # Utilidades generales
```

## 🧪 Testing

El proyecto usa **Vitest** para testing unitario y de integración.

### Ejecutar Tests

```bash
npm test              # Ejecutar tests en modo watch
npm run test:ui       # Abrir UI interactiva de tests
npm run test:coverage # Generar reporte de cobertura
```

### Escribir Tests

- Coloca tests en `__tests__` dentro del mismo directorio
- Usa el sufijo `.test.ts` o `.test.tsx`
- Sigue el patrón AAA (Arrange, Act, Assert)

### Buenas Prácticas

- Funciones puras cuando sea posible
- Dependencias inyectables
- Separación de lógica y UI
- Mock de server actions y APIs
