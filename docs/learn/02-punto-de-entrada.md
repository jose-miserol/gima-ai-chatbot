# 02 — Punto de Entrada de la Aplicación

> Estos archivos son lo primero que Next.js ejecuta al iniciar la app. Definen la estructura HTML base, qué se muestra en la pantalla principal, y los estilos globales.

---

## 📄 `app/layout.tsx` — El Esqueleto HTML

Es el componente estructural primario (Layout Raíz) de la aplicación que actúa como el contenedor maestro de nivel superior al envolver absolutamente todas las páginas y rutas del proyecto en su jerarquía. Sirve para inicializar configuraciones globales que afectan a toda la aplicación de una sola vez, encargándose de inyectar fuentes tipográficas optimizadas, establecer metadatos SEO para buscadores y envolver la aplicación entera en "Providers" de contexto (como manejadores de errores o notificaciones Toast). Existe porque la arquitectura del App Router de Next.js exige un archivo que retorne las etiquetas base del documento web (`<html>` y `<body>`); operando así como el "chasis" de un vehículo, es la base inamovible sobre la cual se montan y desmontan las diferentes pantallas sin recargar la página completa.

### Líneas Clave

```tsx
import { Geist, Geist_Mono } from 'next/font/google';
```

🧠 **Concepto**: Next.js puede cargar fuentes de Google automáticamente, optimizándolas (self-hosting, font-display: swap). Así la app no depende de un CDN externo.

```tsx
const geistSans = Geist({
  variable: '--font-geist-sans', // Crea una variable CSS
  subsets: ['latin'], // Solo carga caracteres latinos
});
```

💡 **¿Por qué `variable`?** En lugar de aplicar la fuente directamente, crea una variable CSS `--font-geist-sans` que Tailwind puede usar. Esto permite combinar fuentes fácilmente.

### Metadata SEO

```tsx
export const metadata: Metadata = {
  title: 'GIMA Chatbot - Sistema de Gestión de Mantenimiento',
  description: 'Asistente inteligente para la gestión de mantenimiento y activos de la UNEG',
  keywords: 'mantenimiento, GIMA, UNEG, chatbot, IA',
  manifest: '/manifest.json', // ← Configuración PWA
};
```

💡 **¿Por qué metadata?** Los buscadores (Google) y las redes sociales leen estos datos para mostrar previews. `manifest.json` permite que la app se instale como PWA en el teléfono.

### Viewport y Tema

```tsx
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Deshabilita zoom (para UX mobile tipo app)
  themeColor: '#1e40af', // Color de la barra del navegador en móviles
};
```

### El Render Principal

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

Desglose línea por línea:

| Línea                      | Qué hace                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `lang="es"`                | Indica a navegadores y lectores de pantalla que el contenido es en español                 |
| `suppressHydrationWarning` | Evita warnings cuando el servidor y el cliente renderizan diferente (ej: temas)            |
| `${geistSans.variable}`    | Inyecta las variables CSS de las fuentes                                                   |
| `antialiased`              | Suaviza las fuentes para que se vean nítidas                                               |
| `<ErrorBoundary>`          | Si cualquier componente hijo falla, muestra un fallback amigable en vez de pantalla blanca |
| `<ToastProvider>`          | Habilita notificaciones tipo "toast" en toda la app                                        |
| `{children}`               | Aquí se renderiza la página actual (ej: `page.tsx`)                                        |

🔗 **Relación**: Todo componente de la app está dentro de este layout. Si necesitas un provider global, agrégalo aquí.

---

## 📄 `app/page.tsx` — La Página Principal

Es el componente de vista principal que se renderiza automáticamente cuando un usuario visita la ruta base o raíz del dominio (`/`), representando la "puerta principal" interactiva de la experiencia del chatbot. Sirve específicamente para aislar, importar y montar el componente complejo del `Chat` utilizando técnicas avanzadas de carga diferida (dynamic import), lo cual asegura que el código pesado del sistema conversacional no demore la visualización inicial de la página, mejorando drásticamente el rendimiento percibido. Existe porque, en la convención de enrutamiento basada en archivos de Next.js, cada archivo `page.tsx` se traduce en una ruta accesible; sin este archivo la raíz no mostraría nada (lanzando un 404), por lo que es indispensable para definir la interfaz exacta que saluda al usuario de entrada.

### El Archivo Completo (19 líneas)

```tsx
'use client'; // ← Marca como Client Component

import dynamic from 'next/dynamic';

const Chat = dynamic(
  () => import('@components/features/chat').then((mod) => ({ default: mod.Chat })),
  {
    ssr: false, // ← No renderizar en servidor
    loading: () => <div className="flex items-center justify-center h-screen">Cargando...</div>,
  }
);

export default function ChatPage() {
  return <Chat />;
}
```

### Explicación Detallada

**`'use client'`**
🧠 **Concepto**: En Next.js App Router, los componentes son de servidor por defecto. `'use client'` los convierte en componentes de cliente (ejecutan en el navegador). El chat necesita el navegador porque usa `localStorage`, `MediaRecorder`, `fetch`, etc.

**`dynamic()` con `ssr: false`**
💡 **¿Por qué carga dinámica?** El componente `Chat` es pesado (~150KB de código). Con `dynamic()`:

1. **No se renderiza en el servidor** — el chat necesita APIs del navegador
2. **Se carga después** del HTML inicial — el usuario ve "Cargando..." mientras se descarga
3. **Code splitting** — el bundle del chat se separa del bundle principal

**`loading: () => ...`**
Muestra un indicador de carga centrado mientras el chunk de JavaScript del Chat se descarga.

---

## 📄 `app/globals.css` — Estilos Globales

Es el manifiesto de estilos en cascada (CSS) base y global, siendo el único archivo CSS tradicional en todo el proyecto que no está encapsulado en un módulo o componente individual. Sirve como fuente única de verdad para la estética general ("Look and Feel"), garantizando que todos los elementos (como botones en distintas áreas) usen exactamente el mismo tono de color al leer las mismas variables, y permite personalizar utilidades y animaciones antes de distribuirse al resto de los componentes. Existe para establecer firmes cimientos visuales que trascienden componentes específicos, ya que allí se declaran las variables maestras que posibilitan el cambio fluido entre modos Claro/Oscuro y se inyecta el núcleo completo del motor Tailwind CSS v4 en la aplicación.

### Líneas Clave

```css
@import 'tailwindcss'; /* Importa todo Tailwind CSS 4 */
@plugin 'tw-animate-css'; /* Plugin de animaciones CSS */
```

🧠 **Concepto**: Tailwind CSS 4 usa `@import` en lugar de directivas `@tailwind`. El plugin `tw-animate-css` agrega clases de animación como `animate-in`, `fade-in`, etc.

### Variables del Tema

```css
:root {
  --background: oklch(1 0 0); /* Blanco */
  --foreground: oklch(0.145 0 0); /* Casi negro */
  --primary: oklch(0.205 0.094 265.75); /* Azul oscuro */
  /* ... más variables */
}

.dark {
  --background: oklch(0.145 0 0); /* Casi negro */
  --foreground: oklch(0.985 0 0); /* Casi blanco */
  --primary: oklch(0.922 0.044 264.05); /* Azul claro */
  /* ... más variables */
}
```

💡 **¿Por qué variables CSS?** En lugar de hardcodear colores en cada componente, todos usan `var(--primary)`. Para cambiar el tema, solo cambias las variables, no cada componente.

💡 **¿Por qué `oklch`?** Es un espacio de color perceptualmente uniforme — los humanos perciben los cambios de color de forma más natural que con `rgb` o `hsl`.

---

## 🔗 Cómo se Conectan

```
Navegador pide localhost:3000
        │
        ▼
  layout.tsx ← Genera <html>, carga fuentes, providers
        │
        ├── globals.css ← Se aplica a todo
        │
        └── page.tsx ← Carga el Chat dinámicamente
              │
              └── dynamic(() => Chat) ← Se descarga como chunk separado
```

---

**← Anterior**: [01 — Archivos Raíz](./01-archivos-raiz.md) | **Siguiente**: [03 — API del Chat](./03-api-chat.md) →
