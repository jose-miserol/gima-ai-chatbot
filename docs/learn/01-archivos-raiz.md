# 01 — Archivos Raíz del Proyecto

> Los archivos en la raíz del proyecto configuran **cómo se construye, ejecuta, formatea y distribuye** la aplicación. Son "el esqueleto" sobre el cual todo lo demás se apoya.

---

## 📄 `package.json` — El DNI del Proyecto

Es el documento de identidad principal (manifiesto) del ecosistema de Node.js para este proyecto, el cual define en formato JSON los metadatos cruciales, la versión actual, las dependencias exactas de software y todas las rutinas de automatización. Sirve para que cualquier entorno (tu máquina, un servidor o CI/CD) sepa exactamente cómo reconstruir el entorno del proyecto, centralizando los comandos (scripts) para levantar el servidor, compilar código o correr pruebas e instruyendo al gestor de paquetes sobre qué código descargar. Su existencia es vital para estandarizar el desarrollo; sin este archivo, cada desarrollador tendría que instalar manualmente decenas de dependencias y recordar comandos complejos. Así se garantiza la consistencia del proyecto y se evita el problema de "en mi computadora sí funciona".

### Líneas Clave

```jsonc
{
  "name": "gima-ai-chatbot",   // Nombre interno del proyecto
  "version": "0.1.0",          // Versión actual (0.x = pre-release)
  "private": true,              // No se publicará en npm
```

💡 **¿Por qué `private: true`?** Previene publicar accidentalmente el proyecto en npm, ya que es un proyecto interno de la UNEG.

### Scripts — Los Comandos que Puedes Ejecutar

```jsonc
"scripts": {
  "dev": "next dev",              // Inicia el servidor local en localhost:3000
  "build": "next build",          // Compila para producción
  "start": "next start",          // Sirve la versión compilada
  "lint": "eslint",               // Revisa errores de código
  "lint:fix": "eslint . --fix",   // Corrige errores automáticamente
  "format": "prettier --write .", // Formatea todo el código
  "type-check": "tsc --noEmit",   // Verifica tipos sin compilar
  "test": "vitest",               // Ejecuta tests
  "test:ui": "vitest --ui",       // Tests con interfaz visual
  "test:coverage": "vitest --coverage", // Tests con cobertura
  "analyze": "cross-env ANALYZE=true next build --webpack", // Analiza el bundle
  "prepare": "husky"              // Configura git hooks automáticamente
}
```

💡 **¿Por qué tantos scripts?** Cada uno resuelve un problema diferente del ciclo de desarrollo: `dev` para programar, `lint` para calidad, `test` para verificar, `build` para producción.

### Dependencias Principales

```jsonc
"dependencies": {
  "@ai-sdk/google": "^2.0.49",       // Conector de Google Gemini
  "@ai-sdk/groq": "^2.0.33",         // Conector de GROQ (Llama 3.3)
  "@ai-sdk/react": "^2.0.117",       // Hooks de React para AI SDK
  "ai": "^5.0.115",                  // Vercel AI SDK v5 (core)
  "next": "16.0.10",                 // Framework Next.js
  "react": "19.2.1",                 // Biblioteca de UI
  "zod": "^4.2.1",                   // Validación de datos
  "motion": "^12.23.26",             // Animaciones (ex Framer Motion)
  "shiki": "^3.20.0",                // Syntax highlighting de código
  "lz-string": "^1.5.0",            // Compresión de texto (para localStorage)
}
```

💡 **¿Por qué `lz-string`?** El chat guarda historial en `localStorage` (máximo ~5MB). Comprimir los mensajes permite guardar hasta 10x más historial.

### Dependencias de Desarrollo

```jsonc
"devDependencies": {
  "vitest": "^4.0.16",               // Framework de testing
  "msw": "^2.12.4",                  // Mock Service Worker (simula APIs)
  "eslint": "^9",                    // Linter de código
  "prettier": "^3.7.4",              // Formateador de código
  "husky": "^9.1.7",                 // Git hooks automáticos
  "@commitlint/cli": "^20.2.0",      // Valida formato de commits
  "tailwindcss": "^4",               // Framework CSS
}
```

### Commitlint — Reglas de Commits

```jsonc
"commitlint": {
  "rules": {
    "type-enum": [2, "always", [
      "feat",     // Nueva funcionalidad
      "fix",      // Corrección de bug
      "docs",     // Solo documentación
      "style",    // Formato (no cambia lógica)
      "refactor", // Reestructuración de código
      "perf",     // Mejora de rendimiento
      "test",     // Agregar/corregir tests
      "build",    // Cambios en build system
      "ci",       // Integración continua
      "chore",    // Tareas de mantenimiento
      "revert"    // Revertir commit previo
    ]]
  }
}
```

💡 **¿Por qué?** Fuerza commits como `feat: agregar transcripción de voz` en lugar de `cambios varios`. Esto hace que el historial de Git sea legible y profesional.

---

## 📄 `next.config.ts` — Configuración de Next.js

Es el archivo de configuración central del framework Next.js, escrito en TypeScript para mayor seguridad, que controla el comportamiento interno del servidor, el proceso de compilación (build) y las reglas de enrutamiento a bajo nivel. Sirve para personalizar el núcleo de la aplicación: define límites de tamaño para la carga de archivos (fundamental para imágenes y audios pesados), establece cabeceras (headers) estrictas de seguridad web, configura políticas de conexión externas (CORS/CSP) e integra herramientas como el analizador de paquetes (bundle analyzer) para optimizar el rendimiento. Existe porque las configuraciones predeterminadas de Next.js rara vez son suficientes para una aplicación en producción, permitiendo adaptar el framework a nuestras necesidades específicas de seguridad y rendimiento y sirviendo como el "panel de control" del servidor.

### Líneas Clave

```typescript
experimental: {
  serverActions: {
    bodySizeLimit: '5mb', // ← Permite subir audio/imágenes de hasta 5MB
  },
},
```

💡 **¿Por qué 5MB?** Los archivos de audio grabados y las fotos de piezas industriales pueden ser grandes. El default de Next.js es solo 1MB, insuficiente para nuestro caso.

### Headers de Seguridad

```typescript
const commonHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' }, // Previene MIME sniffing
  { key: 'X-Frame-Options', value: 'DENY' }, // Previene embebido en iframe
  { key: 'X-XSS-Protection', value: '1; mode=block' }, // Protección XSS del navegador
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
```

🧠 **Concepto**: Estos headers le dicen al navegador cómo proteger al usuario. Cada uno previene un tipo de ataque diferente.

### Content Security Policy (CSP)

```typescript
"connect-src 'self' blob: data: https://api.groq.com https://generativelanguage.googleapis.com",
```

💡 **¿Por qué?** El CSP restringe a qué servidores puede conectarse la app. Solo permite GROQ y Google Gemini — si alguien inyecta código malicioso, no podrá enviar datos a otro servidor.

### Bundle Analyzer

```typescript
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true', // Solo si ejecutas: npm run analyze
});

export default withBundleAnalyzer(nextConfig);
```

💡 **¿Para qué?** Genera un mapa visual del bundle de producción, mostrando qué dependencia ocupa más espacio. Útil para optimizar.

---

## 📄 `tsconfig.json` — Configuración de TypeScript

Es el archivo de directrices para el compilador de TypeScript que define el conjunto de reglas exactas bajo las cuales el código estático será evaluado y transformado a JavaScript entendible por navegadores. Sirve para establecer el nivel de rigor del tipado (como el `strict mode`), configurar "paths aliases" (atajos de rutas como `@/components` en lugar de `../../../components`), y dictar a qué versión de JavaScript debe compilarse el proyecto para asegurar compatibilidad. Existe con el fin principal de prevenir errores humanos antes de ejecutar el código; al definir reglas estrictas aquí, obligamos al equipo a escribir código robusto y mantenible, atrapando bugs de tipos, variables no definidas o nulos potenciales en tiempo de desarrollo.

### Líneas Clave Importantes

```jsonc
{
  "compilerOptions": {
    "strict": true, // ← Máxima seguridad de tipos
    "paths": {
      "@/*": ["./app/*"], // import { x } from '@/app/config'
      "@components/*": ["./app/components/*"], // import { Button } from '@components/ui/button'
    },
  },
}
```

💡 **¿Por qué paths alias?** En vez de escribir `../../../components/ui/button`, puedes escribir `@components/ui/button`. Más legible y no se rompe si mueves archivos.

💡 **¿Por qué strict mode?** Fuerza al compilador a reportar errores que normalmente ignoraría (variables posiblemente `null`, tipos implícitos `any`, etc.). Previene bugs en runtime.

---

## 📄 `vitest.config.ts` — Configuración de Testing

Es el archivo que rige el comportamiento de Vitest, nuestro marco automatizado de pruebas (testing framework) ultrarrápido compatible con Vite. Sirve para preparar el terreno antes de ejecutar las pruebas unitarias: configura un navegador simulado (`jsdom`) para que los componentes integrados de React puedan probarse en la terminal, define qué plugins usar y especifica qué carpetas de código deben analizarse en busca de tests. Existe porque las pruebas necesitan un entorno aislado, controlado e idéntico al de producción pero sin depender de un navegador real, por lo que centralizar esta configuración garantiza que todas las pruebas corran bajo las mismas simulaciones de forma rápida y confiable.

🧠 **Concepto**: `jsdom` es un navegador simulado en Node.js. Permite que los tests de React rendericen componentes sin abrir un navegador real.

---

## 📄 `eslint.config.mjs` — Reglas de Código

Es el reglamento de control de calidad para el código fuente, utilizando el moderno formato plano de ESLint 9, que actúa como un corrector ortográfico y gramatical pero enfocado a programación. Sirve para analizar estáticamente cada archivo creado y advertir o bloquear malas prácticas, errores lógicos, código muerto o variables no utilizadas, asegurando además que las convenciones de accesibilidad (a11y) y las reglas específicas de React se cumplan a cabalidad. Existe para mantener una base de código limpia y homogénea sin importar cuántas personas trabajen en el proyecto, evitando así la acumulación de deuda técnica y garantizando que los bugs triviales sean detectados inmediatamente en el propio editor.

---

## 📄 `components.json` — Configuración de shadcn/ui

Es el catálogo de configuración de `shadcn/ui`, nuestro sistema de componentes de interfaz, que actúa como un mapa de ruta para la herramienta de línea de comandos (CLI) de esta librería. Sirve para instruir al instalador automático sobre dónde debe inyectar el código fuente de los nuevos componentes agregados (por ejemplo, un botón o un modal), definir qué prefijos de ruta utilizar y cómo están estructuradas nuestras variables del sistema de diseño (Tailwind CSS). Existe porque `shadcn/ui` no se instala como una dependencia tradicional opaca desde npm, sino que inyecta código directamente modificable en nuestro proyecto; este archivo asegura que dicha inyección ocurra en las carpetas correctas cada vez, manteniendo una arquitectura limpia y ordenada.

---

## 📄 `.env.example` — Plantilla de Variables de Entorno

Es un mapa de referencia o "plantilla vacía" que enumera todas las variables de entorno (datos sensibles, URLs, claves de servicio) que la aplicación requiere para funcionar. Sirve como guía de instalación para cualquier desarrollador nuevo o servidor de despliegue, indicándole claramente qué claves y tokens (por ejemplo, de Gemini o la base de datos) debe conseguir y configurar localmente en su propio archivo secreto `.env.local` sin exponer los valores reales al público. Existe por motivos estrictos de seguridad, ya que los secretos reales nunca deben subirse al repositorio de código (Git), y provee la estructura requerida permitiendo que el proyecto se documente a sí mismo sin filtrar información confidencial.

⚠️ **Cuidado**: Nunca subas tu archivo `.env.local` generado a Git. Contiene secretos (API keys) reales que podrían ser explotados.

---

## 📄 `.prettierrc` y `.prettierignore`

Son documentos que dictan el estilo visual y estético de escritura del código fuente, impulsados por la herramienta automática Prettier. Sirven para unificar globalmente la forma en la que se ve el código: el tipo de comillas a usar, la cantidad de espacios para indentación, el uso de puntos y comas y la longitud máxima de cada línea (junto con un `.prettierignore` que excluye carpetas autogeneradas). Existen para terminar definitivamente con los debates sobre el formato del código en el equipo, ya que Prettier reescribe el código bajo un único estándar uniforme al momento de guardar cada archivo, maximizando la legibilidad y enfocando al equipo en programar lógica en vez de ajustar espacios.

---

## 📄 `.gitignore`

Actúa como una lista negra fundamental para el control de versiones; es un archivo de texto simple con patrones de archivos y carpetas que el sistema Git ignora y jamás sube al repositorio remoto. Sirve para bloquear la subida accidental de dependencias pesadas (como `node_modules/`), de carpetas generadas automáticamente durante la compilación (como `.next/` o `dist/`) y de archivos privados que contienen contraseñas o datos locales del desarrollador (como `.env.local`). Su existencia es crucial para mantener el peso del repositorio ligero, el historial de cambios limpio y asegurar que configuraciones locales o secretos jamás se compartan públicamente ni comprometan el sistema.

---

## 🔗 Relaciones entre Archivos Raíz

```
package.json ──→ Define dependencias ──→ node_modules/
     │
     ├──→ scripts.dev ──→ next.config.ts ──→ Inicia servidor
     ├──→ scripts.lint ──→ eslint.config.mjs ──→ Analiza código
     ├──→ scripts.test ──→ vitest.config.ts ──→ Ejecuta tests
     └──→ commitlint ──→ .husky/ ──→ Valida commits
```

---

**Siguiente**: [02 — Punto de Entrada](./02-punto-de-entrada.md) →
