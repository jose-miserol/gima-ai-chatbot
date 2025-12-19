# Guía de Contribución - GIMA AI Chatbot

¡Gracias por tu interés en mejorar este proyecto! Esta guía establece los estándares para mantener la calidad y consistencia del código.

## 🛠️ Herramientas Requeridas

- **Node.js**: v20 o superior
- **Gestor de paquetes**: npm (usamos `package-lock.json`)
- **Editor**: VS Code (recomendado con extensiones de ESLint y Prettier)

## 📋 Flujo de Trabajo

### 1. Preparación del Entorno

```bash
npm install
cp .env.example .env.local
# Configura tus API Keys en .env.local
```

### 2. Comandos Clave

- `npm run dev`: Inicia servidor de desarrollo
- `npm run lint`: Verifica estilo de código
- `npm run type-check`: Verifica tipos de TypeScript
- `npm run format`: Formatea todo el código con Prettier

### 3. Git Hooks (Husky)

Este proyecto utiliza Husky para verificar el código antes de cada commit.
Al hacer `git commit`, se ejecutará automáticamente `lint-staged` para:

- Corregir estilo (ESLint --fix)
- Formatear código (Prettier)

## 📐 Estándares de Código

### TypeScript

- **Strict Mode**: Activado. No usar `any`.
- **Interfaces**: Prefiere `interface` sobre `type` para definiciones de objetos.
- **Imports**: Usar alias `@/` para rutas absolutas.

### Componentes React

- Usar componentes funcionales y Hooks.
- Colocar componentes UI reutilizables en `app/components/ui`.
- Usar Server Components por defecto, agregar `'use client'` solo cuando sea necesario.

### Commits

Seguimos la convención **Conventional Commits**:

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Cambios en documentación
- `style:` Cambios de formato (espacios, comas, etc)
- `refactor:` Refactorización de código sin cambio de lógica
- `test:` Agregar o corregir tests
- `chore:` Tareas de mantenimiento (build, deps)

Ejemplo: `feat(chat): add voice input support`

## 🧪 Testing (Próximamente/Pospuesto)

Aunque la fase de testing está pospuesta, se recomienda escribir código testable (funciones puras, dependencias inyectables).
